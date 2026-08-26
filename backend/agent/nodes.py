"""LangGraph agent nodes."""
from __future__ import annotations

import os
import re
from datetime import date, timedelta
from typing import Awaitable, Callable

import httpx
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from agent.prompts import SYSTEM_PROMPT, build_prompt
from agent.state import ShopState
from services.streaming_pipeline import run_streaming_pipeline

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
TAVILY_API_KEY = os.getenv("TAVILY_API_KEY", "")
TAVILY_SEARCH_URL = "https://api.tavily.com/search"

StreamCallback = Callable[[str, bytes | None], Awaitable[None]]


async def classify_intent(state: ShopState, db: AsyncSession) -> ShopState:
    query = state["query"].lower()

    if any(w in query for w in ["kyun", "why", "kyu", "reason", "gir", "drop", "kam"]):
        state["intent"] = "sales_query"
    elif any(w in query for w in ["forecast", "predict", "kal", "agle", "next"]):
        state["intent"] = "forecast"
    elif any(w in query for w in ["invoice", "bill", "banaao", "generate"]):
        state["intent"] = "invoice"
    elif any(w in query for w in ["price", "daam", "mandi", "rate", "competitor"]):
        state["intent"] = "competitor"
    elif any(w in query for w in ["alert", "warning", "risk", "khabar"]):
        state["intent"] = "alert"
    else:
        state["intent"] = "general"

    return state


async def fetch_sales_data(state: ShopState, db: AsyncSession) -> ShopState:
    from db.models import Product, SalesEntry

    shop_id = state["shop_id"]
    today = date.today()
    week_ago = today - timedelta(days=7)
    month_ago = today - timedelta(days=30)

    result = await db.execute(
        select(
            Product.name,
            func.sum(SalesEntry.quantity_sold).label("total_qty"),
            func.sum(SalesEntry.revenue).label("total_rev"),
        )
        .join(Product, Product.id == SalesEntry.product_id)
        .where(and_(SalesEntry.shop_id == shop_id, SalesEntry.entry_date >= week_ago))
        .group_by(Product.name)
    )
    rows_7d = result.all()

    result_30d = await db.execute(
        select(
            func.sum(SalesEntry.revenue).label("total_rev"),
            func.sum(SalesEntry.quantity_sold).label("total_qty"),
        ).where(and_(SalesEntry.shop_id == shop_id, SalesEntry.entry_date >= month_ago))
    )
    totals_30d = result_30d.one_or_none()

    state["sales_data"] = {
        "products_7d": [
            {"name": row.name, "qty": float(row.total_qty or 0), "revenue": float(row.total_rev or 0)}
            for row in rows_7d
        ],
        "total_30d_revenue": float(totals_30d.total_rev or 0) if totals_30d else 0,
        "total_30d_qty": float(totals_30d.total_qty or 0) if totals_30d else 0,
    }
    return state


async def fetch_market_data(state: ShopState, db: AsyncSession) -> ShopState:
    from db.models import MarketPrice, Shop

    shop_result = await db.execute(select(Shop).where(Shop.id == state["shop_id"]))
    shop = shop_result.scalar_one_or_none()
    district = shop.district if shop else "Nagpur"

    result = await db.execute(
        select(MarketPrice)
        .where(MarketPrice.district == district)
        .order_by(MarketPrice.price_date.desc())
        .limit(20)
    )
    prices = result.scalars().all()

    seen: set[str] = set()
    market_data: dict[str, dict] = {}
    for price in prices:
        if price.commodity in seen:
            continue
        seen.add(price.commodity)
        market_data[price.commodity] = {
            "price": float(price.modal_price),
            "source": price.source,
            "date": price.price_date.isoformat() if price.price_date else None,
        }

    state["market_data"] = market_data
    return state


async def fetch_forecast_data(state: ShopState, db: AsyncSession) -> ShopState:
    from db.models import MLForecast, Product

    today = date.today()
    product_result = await db.execute(
        select(Product).where(Product.shop_id == state["shop_id"]).order_by(Product.name.asc()).limit(5)
    )
    products = product_result.scalars().all()

    forecast_data: dict[str, list[dict]] = {}
    for product in products:
        result = await db.execute(
            select(MLForecast)
            .where(
                and_(
                    MLForecast.shop_id == state["shop_id"],
                    MLForecast.product_id == product.id,
                    MLForecast.forecast_date >= today,
                )
            )
            .order_by(MLForecast.forecast_date.asc())
            .limit(7)
        )
        rows = result.scalars().all()
        if rows:
            forecast_data[product.name] = [
                {
                    "date": row.forecast_date.isoformat(),
                    "predicted_qty": float(row.predicted_qty or 0),
                }
                for row in rows
            ]

    state["forecast_data"] = forecast_data
    return state


async def fetch_web_context(state: ShopState, db: AsyncSession) -> ShopState:
    from db.models import Shop

    if not TAVILY_API_KEY:
        state["web_context"] = []
        return state

    shop_result = await db.execute(select(Shop).where(Shop.id == state["shop_id"]))
    shop = shop_result.scalar_one_or_none()
    district = shop.district if shop else "Nagpur"
    intent = state.get("intent") or "general"
    query = state.get("query", "")

    if intent == "competitor":
        search_query = f"{query} kirana grocery competitor prices {district} India today"
    elif intent == "alert":
        search_query = f"{query} mandi price movement wholesale supply news {district} India today"
    else:
        search_query = f"{query} mandi market rates grocery trends {district} India today"

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            response = await client.post(
                TAVILY_SEARCH_URL,
                json={
                    "api_key": TAVILY_API_KEY,
                    "query": search_query,
                    "search_depth": "basic",
                    "max_results": 3,
                },
            )
            if response.status_code == 200:
                results = response.json().get("results", [])
                state["web_context"] = [
                    {
                        "title": item.get("title", ""),
                        "content": item.get("content", "")[:240],
                        "url": item.get("url", ""),
                    }
                    for item in results
                ]
                return state
    except Exception as exc:
        print(f"[Agent] Tavily error: {exc}")

    state["web_context"] = []
    return state


def build_messages(state: ShopState) -> list[dict]:
    user_prompt = build_prompt(state)
    history = state.get("conversation_history") or []
    messages: list[dict] = [{"role": "system", "content": SYSTEM_PROMPT}]

    for turn in history[-6:]:
        role = turn.get("role", "user")
        if role in ("user", "assistant"):
            messages.append({"role": role, "content": turn.get("text", "")})

    messages.append({"role": "user", "content": user_prompt})
    return messages


async def generate_response(
    state: ShopState,
    db: AsyncSession,
    on_stream: StreamCallback | None = None,
) -> ShopState:
    if not GROQ_API_KEY:
        raise RuntimeError("GROQ_API_KEY is missing. Real LLM connection is required.")

    try:
        messages = build_messages(state)
        if on_stream:
            content = await run_streaming_pipeline(messages, state.get("language", "en"), on_token=on_stream)
        else:
            async with httpx.AsyncClient(timeout=20) as client:
                response = await client.post(
                    "https://api.groq.com/openai/v1/chat/completions",
                    headers={
                        "Authorization": f"Bearer {GROQ_API_KEY}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": os.getenv("GROQ_MODEL", "groq/compound"),
                        "messages": messages,
                        "temperature": 0.7,
                        "max_tokens": 500,
                    },
                )
                if response.status_code != 200:
                    raise RuntimeError(f"Groq returned {response.status_code}")
                content = response.json()["choices"][0]["message"]["content"]
        return _parse_response(state, content)
    except Exception as exc:
        print(f"[Agent] Groq error: {exc}")
        raise RuntimeError(f"Failed to generate response: {exc}")


def _strip_markdown(text: str) -> str:
    text = re.sub(r"<think>.*?</think>", "", text, flags=re.DOTALL)
    text = re.sub(r"\*{1,3}", "", text)
    text = re.sub(r"_{1,3}", " ", text)
    text = re.sub(r"^#{1,6}\s*", "", text, flags=re.MULTILINE)
    text = re.sub(r"^\s*[-*+]\s+", "", text, flags=re.MULTILINE)
    text = re.sub(r"^\s*\d+\.\s+", "", text, flags=re.MULTILINE)
    text = re.sub(r"`{1,3}", "", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = re.sub(r"  +", " ", text)
    return text.strip()



def _parse_response(state: ShopState, content: str) -> ShopState:
    content = _strip_markdown(content)

    why_match = re.search(r"WHY[:\s]+(.+?)(?=WHAT|Rs\.?\s*IMPACT|$)", content, re.DOTALL | re.IGNORECASE)
    what_match = re.search(r"WHAT[:\s]+(.+?)(?=Rs\.?\s*IMPACT|$)", content, re.DOTALL | re.IGNORECASE)
    impact_match = re.search(r"Rs\.?\s*IMPACT[:\s]+(.+?)$", content, re.DOTALL | re.IGNORECASE)

    if why_match:
        state["why_text"] = _strip_markdown(why_match.group(1).strip())
    else:
        sentence_parts = [part.strip() for part in re.split(r"(?<=[.!?])\s+", content) if part.strip()]
        state["why_text"] = sentence_parts[0] if sentence_parts else content[:150]

    if what_match:
        state["what_text"] = _strip_markdown(what_match.group(1).strip())
    else:
        sentence_parts = [part.strip() for part in re.split(r"(?<=[.!?])\s+", content) if part.strip()]
        state["what_text"] = sentence_parts[1] if len(sentence_parts) > 1 else ""
    state["response_text"] = content

    if impact_match:
        rupee_numbers = re.findall(r"Rs\.?\s*([0-9,]+)", impact_match.group(1))
        if not rupee_numbers:
            rupee_numbers = re.findall(r"₹\s*([0-9,]+)", impact_match.group(1))
        state["rupees_impact"] = float(rupee_numbers[0].replace(",", "")) if rupee_numbers else 0
    else:
        state["rupees_impact"] = 0

    state["alert_triggered"] = False
    return state
