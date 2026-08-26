"""LangGraph agent execution."""
from __future__ import annotations

import asyncio
from typing import Awaitable, Callable

from sqlalchemy.ext.asyncio import AsyncSession

from agent.nodes import (
    classify_intent,
    fetch_forecast_data,
    fetch_market_data,
    fetch_sales_data,
    fetch_web_context,
    generate_response,
)
from agent.state import ShopState
from db.database import async_session

StreamCallback = Callable[[str, bytes | None], Awaitable[None]]


async def _run_node_with_fresh_session(state: ShopState, node):
    async with async_session() as session:
        return await node(dict(state), session)  # type: ignore[arg-type]


async def run_agent(
    shop_id: int,
    transcript: str,
    language: str = "en",
    db: AsyncSession | None = None,
    conversation_history: list[dict] | None = None,
    on_stream: StreamCallback | None = None,
) -> dict:
    state: ShopState = {
        "user_id": 0,
        "shop_id": shop_id,
        "query": transcript,
        "language": language,
        "conversation_history": conversation_history or [],
        "sales_data": None,
        "market_data": None,
        "forecast_data": None,
        "web_context": None,
        "intent": None,
        "why_text": None,
        "what_text": None,
        "rupees_impact": None,
        "response_text": None,
        "alert_triggered": None,
    }

    if not db:
        raise ValueError("Database session is required for real connections.")

    state = await classify_intent(state, db)

    state_sales, state_market, state_forecast, state_web = await asyncio.gather(
        _run_node_with_fresh_session(state, fetch_sales_data),
        _run_node_with_fresh_session(state, fetch_market_data),
        _run_node_with_fresh_session(state, fetch_forecast_data),
        _run_node_with_fresh_session(state, fetch_web_context),
    )

    state["sales_data"] = state_sales.get("sales_data")
    state["market_data"] = state_market.get("market_data")
    state["forecast_data"] = state_forecast.get("forecast_data")
    state["web_context"] = state_web.get("web_context")

    state = await generate_response(state, db, on_stream=on_stream)

    return {
        "why_text": state.get("why_text", ""),
        "what_text": state.get("what_text", ""),
        "rupees_impact": state.get("rupees_impact", 0),
        "response_text": state.get("response_text", ""),
        "alert_id": None,
        "intent": state.get("intent", "general"),
    }
