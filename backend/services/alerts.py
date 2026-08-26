"""News-aware risk and opportunity alert evaluation."""
from __future__ import annotations

import os
from datetime import date, datetime, timedelta, timezone

import httpx
from sqlalchemy import and_, delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from db.models import MLForecast, MarketPrice, NewsSignalCache, Product, SalesEntry, Shop, User
from ml.risk_detector import check_anomaly, detect_risk
from services.inventory import stock_status

TAVILY_API_KEY = os.getenv("TAVILY_API_KEY", "")
TAVILY_SEARCH_URL = "https://api.tavily.com/search"
NEWS_TTL_HOURS = 6

GEO_PRIORITY = {"district": 0, "state": 1, "national": 2, "global": 3}
SEVERITY_PRIORITY = {"HIGH": 0, "MEDIUM": 1, "LOW": 2}

RISK_KEYWORDS: dict[str, tuple[tuple[str, ...], str, str, float, float]] = {
    "supply_disruption": (
        ("shortage", "disruption", "strike", "delay", "transport", "blocked", "flood", "crop damage"),
        "HIGH",
        "Supply disruption may raise buying cost soon.",
        18.0,
        0.84,
    ),
    "cost_pressure": (
        ("price rise", "prices rise", "inflation", "fuel cost", "freight", "logistics cost"),
        "MEDIUM",
        "Input cost pressure is building for the next few days.",
        12.0,
        0.76,
    ),
}

OPPORTUNITY_KEYWORDS: dict[str, tuple[tuple[str, ...], str, str, float, float]] = {
    "early_stock": (
        ("price increase", "prices may rise", "demand surge", "festival demand", "supply tightening", "export demand"),
        "HIGH",
        "Early stocking may protect margin before prices move up.",
        22.0,
        0.82,
    ),
    "event_spike": (
        ("festival", "wedding season", "heatwave", "monsoon demand", "seasonal demand"),
        "MEDIUM",
        "Upcoming local demand could lift sell-through and pricing power.",
        14.0,
        0.72,
    ),
}

def _now() -> datetime:
    return datetime.now(timezone.utc)


def _coerce_utc(dt: datetime | None) -> datetime | None:
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _alert_id(product_id: int, slot: int) -> int:
    return product_id * 1000 + slot


def _clean_text(*parts: str | None) -> str:
    return " ".join(part.strip() for part in parts if part).strip()


def _make_alert(
    *,
    alert_id: int,
    product: Product,
    severity: str,
    kind: str,
    signal_source: str,
    geo_scope: str,
    message: str,
    reason: str,
    action_hint: str,
    confidence: float,
    created_at: datetime,
    expires_at: datetime | None = None,
) -> dict:
    return {
        "id": alert_id,
        "product_id": product.id,
        "product_name": product.name,
        "severity": severity,
        "kind": kind,
        "signal_source": signal_source,
        "geo_scope": geo_scope,
        "message": message,
        "reason": reason,
        "action_hint": action_hint,
        "confidence": round(confidence, 2),
        "created_at": created_at.isoformat(),
        "expires_at": expires_at.isoformat() if expires_at else None,
    }


async def _load_shop_context(db: AsyncSession, shop_id: int) -> tuple[Shop | None, User | None]:
    shop_result = await db.execute(select(Shop).where(Shop.id == shop_id))
    shop = shop_result.scalar_one_or_none()
    if not shop:
        return None, None

    user_result = await db.execute(select(User).where(User.id == shop.user_id))
    return shop, user_result.scalar_one_or_none()


def _geo_queries(product: Product, shop: Shop | None, user: User | None) -> list[tuple[str, str]]:
    commodity = product.agmarknet_commodity or product.name
    district = shop.district if shop and shop.district else ""
    state = user.state if user and user.state else ""
    queries: list[tuple[str, str]] = []

    if district:
        queries.append(("district", f"{commodity} price shortage demand {district} {state or 'India'} kirana next few days"))
    if state:
        queries.append(("state", f"{commodity} mandi price demand supply {state} India next few days"))
    queries.append(("national", f"{commodity} India wholesale price demand supply next few days"))
    queries.append(("global", f"{commodity} global commodity price supply demand next few days India impact"))
    return queries


def _extract_signal(
    *,
    product: Product,
    geo_scope: str,
    title: str,
    content: str,
    urls: list[str],
) -> dict | None:
    text = _clean_text(title, content).lower()

    for signal_name, (keywords, severity, reason, strength, confidence) in OPPORTUNITY_KEYWORDS.items():
        if any(keyword in text for keyword in keywords):
            return {
                "signal_kind": "opportunity",
                "signal_source": "news",
                "geo_scope": geo_scope,
                "title": title,
                "summary": f"{product.name}: {reason}",
                "action_hint": f"Consider stocking {product.name.lower()} early and review pricing daily.",
                "signal_strength": strength,
                "confidence": confidence if geo_scope in {"district", "state"} else confidence - 0.08,
                "urls": urls,
            }

    for signal_name, (keywords, severity, reason, strength, confidence) in RISK_KEYWORDS.items():
        if any(keyword in text for keyword in keywords):
            return {
                "signal_kind": "risk",
                "signal_source": "news",
                "geo_scope": geo_scope,
                "title": title,
                "summary": f"{product.name}: {reason}",
                "action_hint": f"Recheck buying cost and stock cover for {product.name.lower()} now.",
                "signal_strength": strength,
                "confidence": confidence if geo_scope in {"district", "state"} else confidence - 0.08,
                "urls": urls,
            }

    return None


async def _fetch_news_signal_for_scope(
    client: httpx.AsyncClient,
    *,
    product: Product,
    geo_scope: str,
    query: str,
) -> dict | None:
    response = await client.post(
        TAVILY_SEARCH_URL,
        json={
            "api_key": TAVILY_API_KEY,
            "query": query,
            "search_depth": "basic",
            "max_results": 3,
            "include_answer": False,
        },
    )
    if response.status_code != 200:
        return None

    payload = response.json()
    results = payload.get("results", [])
    for item in results:
        signal = _extract_signal(
            product=product,
            geo_scope=geo_scope,
            title=str(item.get("title", "")),
            content=str(item.get("content", "")),
            urls=[str(item.get("url", ""))] if item.get("url") else [],
        )
        if signal:
            return signal
    return None


async def refresh_shop_news_context(db: AsyncSession, shop_id: int) -> None:
    if not TAVILY_API_KEY:
        return

    shop, user = await _load_shop_context(db, shop_id)
    if not shop:
        return

    products_result = await db.execute(select(Product).where(Product.shop_id == shop_id))
    products = products_result.scalars().all()

    now = _now()
    async with httpx.AsyncClient(timeout=18) as client:
        for product in products:
            for geo_scope, query in _geo_queries(product, shop, user):
                try:
                    signal = await _fetch_news_signal_for_scope(
                        client,
                        product=product,
                        geo_scope=geo_scope,
                        query=query,
                    )
                except Exception as exc:
                    print(f"[Alerts] Tavily news fetch failed for {product.name} {geo_scope}: {exc}")
                    continue

                expires_at = now + timedelta(hours=NEWS_TTL_HOURS)
                existing_result = await db.execute(
                    select(NewsSignalCache).where(
                        NewsSignalCache.shop_id == shop_id,
                        NewsSignalCache.product_id == product.id,
                        NewsSignalCache.geo_scope == geo_scope,
                    )
                )
                existing = existing_result.scalar_one_or_none()

                if not signal:
                    existing_expires_at = _coerce_utc(existing.expires_at) if existing else None
                    if existing and existing_expires_at and existing_expires_at < now:
                        await db.delete(existing)
                    continue

                if existing:
                    existing.signal_kind = signal["signal_kind"]
                    existing.signal_source = signal["signal_source"]
                    existing.title = signal["title"]
                    existing.summary = signal["summary"]
                    existing.action_hint = signal["action_hint"]
                    existing.signal_strength = signal["signal_strength"]
                    existing.confidence = signal["confidence"]
                    existing.urls = signal["urls"]
                    existing.fetched_at = now
                    existing.expires_at = expires_at
                else:
                    db.add(
                        NewsSignalCache(
                            shop_id=shop_id,
                            product_id=product.id,
                            geo_scope=geo_scope,
                            signal_kind=signal["signal_kind"],
                            signal_source=signal["signal_source"],
                            title=signal["title"],
                            summary=signal["summary"],
                            action_hint=signal["action_hint"],
                            signal_strength=signal["signal_strength"],
                            confidence=signal["confidence"],
                            urls=signal["urls"],
                            freshness_hours=NEWS_TTL_HOURS,
                            fetched_at=now,
                            expires_at=expires_at,
                        )
                    )

    await db.commit()


async def _load_fresh_news_signals(db: AsyncSession, shop_id: int) -> dict[int, list[NewsSignalCache]]:
    now = _now()
    result = await db.execute(
        select(NewsSignalCache)
        .where(NewsSignalCache.shop_id == shop_id)
        .order_by(NewsSignalCache.product_id.asc(), NewsSignalCache.geo_scope.asc())
    )
    signal_map: dict[int, list[NewsSignalCache]] = {}
    stale_rows: list[NewsSignalCache] = []
    for row in result.scalars().all():
        expires_at = _coerce_utc(row.expires_at)
        if expires_at is None:
            continue
        if expires_at < now:
            stale_rows.append(row)
            continue
        signal_map.setdefault(row.product_id, []).append(row)

    for row in stale_rows:
        await db.delete(row)

    if stale_rows:
        await db.commit()
    return signal_map


async def compute_shop_alerts(
    db: AsyncSession,
    shop_id: int,
    *,
    refresh_news: bool = False,
) -> list[dict]:
    today = date.today()
    seven_days_ago = today - timedelta(days=6)
    created_at = _now()

    if refresh_news:
        await refresh_shop_news_context(db, shop_id)

    shop, user = await _load_shop_context(db, shop_id)

    products_result = await db.execute(
        select(Product).where(Product.shop_id == shop_id).order_by(Product.name.asc())
    )
    products = products_result.scalars().all()

    avg_sales_result = await db.execute(
        select(
            SalesEntry.product_id,
            (func.coalesce(func.sum(SalesEntry.quantity_sold), 0) / 7.0).label("avg_daily_qty"),
        )
        .where(
            SalesEntry.shop_id == shop_id,
            SalesEntry.entry_date >= seven_days_ago,
        )
        .group_by(SalesEntry.product_id)
    )
    avg_sales_map = {row.product_id: float(row.avg_daily_qty or 0) for row in avg_sales_result}

    today_sales_result = await db.execute(
        select(
            SalesEntry.product_id,
            func.coalesce(func.sum(SalesEntry.quantity_sold), 0).label("today_qty"),
        )
        .where(SalesEntry.shop_id == shop_id, SalesEntry.entry_date == today)
        .group_by(SalesEntry.product_id)
    )
    today_sales_map = {row.product_id: float(row.today_qty or 0) for row in today_sales_result}

    forecast_result = await db.execute(
        select(MLForecast)
        .where(
            and_(
                MLForecast.shop_id == shop_id,
                MLForecast.forecast_date >= today,
                MLForecast.forecast_date <= today + timedelta(days=7),
            )
        )
        .order_by(MLForecast.product_id.asc(), MLForecast.forecast_date.asc())
    )
    forecast_map: dict[int, MLForecast] = {}
    for row in forecast_result.scalars().all():
        forecast_map.setdefault(row.product_id, row)

    market_map: dict[str, float] = {}
    if shop and shop.district:
        market_result = await db.execute(
            select(MarketPrice)
            .where(MarketPrice.district == shop.district)
            .order_by(MarketPrice.price_date.desc())
        )
        for row in market_result.scalars().all():
            if row.commodity and row.commodity not in market_map:
                market_map[row.commodity] = float(row.modal_price or 0)

    news_signal_map = await _load_fresh_news_signals(db, shop_id)

    alerts: list[dict] = []

    for product in products:
        avg_daily_qty = float(avg_sales_map.get(product.id, 0))
        today_qty = float(today_sales_map.get(product.id, 0))
        stock_qty = float(product.stock_qty or 0)
        minimum_required = max(round(avg_daily_qty * 3, 1), 5.0)
        state = stock_status(stock_qty, minimum_required)

        if state == "CRITICAL":
            alerts.append(
                _make_alert(
                    alert_id=_alert_id(product.id, 1),
                    product=product,
                    severity="HIGH",
                    kind="risk",
                    signal_source="inventory",
                    geo_scope="district",
                    message=f"Stock is critical at {stock_qty:g} {product.unit}. You may lose sales if demand continues.",
                    reason=f"Minimum required is {minimum_required:g} {product.unit} based on recent demand.",
                    action_hint=f"Restock {product.name.lower()} today and secure at least 3 days of cover.",
                    confidence=0.95,
                    created_at=created_at,
                )
            )
        elif state == "LOW_STOCK":
            alerts.append(
                _make_alert(
                    alert_id=_alert_id(product.id, 2),
                    product=product,
                    severity="MEDIUM",
                    kind="risk",
                    signal_source="inventory",
                    geo_scope="district",
                    message=f"Stock is low at {stock_qty:g} {product.unit}. Refill soon before you miss demand.",
                    reason=f"Minimum required is {minimum_required:g} {product.unit} based on recent demand.",
                    action_hint=f"Plan a refill for {product.name.lower()} within the next buying cycle.",
                    confidence=0.9,
                    created_at=created_at,
                )
            )

        forecast = forecast_map.get(product.id)
        if forecast and avg_daily_qty > 0:
            risk = detect_risk(float(forecast.predicted_qty or 0), avg_daily_qty)
            if risk["level"] in {"HIGH", "MEDIUM"}:
                alerts.append(
                    _make_alert(
                        alert_id=_alert_id(product.id, 3),
                        product=product,
                        severity=risk["level"],
                        kind="risk",
                        signal_source="forecast",
                        geo_scope="district",
                        message=f"Forecast shows softer demand for {product.name.lower()}.",
                        reason=f"Expected {float(forecast.predicted_qty or 0):g} {product.unit} vs recent average {avg_daily_qty:g}.",
                        action_hint=f"Review price, display position, and bundled offers for {product.name.lower()}.",
                        confidence=0.78,
                        created_at=created_at,
                    )
                )

            if forecast.forecast_date == today and float(forecast.predicted_qty or 0) > 0 and today_qty > 0:
                is_anomaly, deviation = check_anomaly(today_qty, float(forecast.predicted_qty))
                if is_anomaly:
                    alerts.append(
                        _make_alert(
                            alert_id=_alert_id(product.id, 4),
                            product=product,
                            severity="HIGH",
                            kind="risk",
                            signal_source="hybrid",
                            geo_scope="district",
                            message=f"Today's sales are {abs(deviation):.0f}% below forecast for {product.name.lower()}.",
                            reason="This may indicate weak pricing, low visibility, or sudden local demand softness.",
                            action_hint=f"Audit shelf visibility and compare market price for {product.name.lower()} today.",
                            confidence=0.88,
                            created_at=created_at,
                        )
                    )

        commodity_key = (product.agmarknet_commodity or product.name or "").strip()
        mandi_price = market_map.get(commodity_key)
        cost_price = float(product.cost_price or 0)
        if mandi_price and cost_price and mandi_price > cost_price * 1.12:
            alerts.append(
                _make_alert(
                    alert_id=_alert_id(product.id, 5),
                    product=product,
                    severity="MEDIUM",
                    kind="risk",
                    signal_source="market_price",
                    geo_scope="district",
                    message=f"Mandi cost pressure detected for {product.name.lower()}.",
                    reason=f"Current market price is Rs.{mandi_price:g} vs cost base Rs.{cost_price:g}.",
                    action_hint=f"Consider buying sooner or adjusting price for {product.name.lower()} carefully.",
                    confidence=0.74,
                    created_at=created_at,
                )
            )

        for index, signal in enumerate(news_signal_map.get(product.id, []), start=6):
            severity = "HIGH" if signal.signal_strength >= 18 else "MEDIUM"
            alerts.append(
                _make_alert(
                    alert_id=_alert_id(product.id, index),
                    product=product,
                    severity=severity,
                    kind=signal.signal_kind,
                    signal_source=signal.signal_source or "news",
                    geo_scope=signal.geo_scope,
                    message=signal.summary or f"News signal detected for {product.name.lower()}.",
                    reason=signal.title or "Fresh market/news context indicates a likely business impact.",
                    action_hint=signal.action_hint or f"Review buying plan for {product.name.lower()} now.",
                    confidence=float(signal.confidence or 0.65),
                    created_at=signal.fetched_at or created_at,
                    expires_at=signal.expires_at,
                )
            )

    alerts.sort(
        key=lambda alert: (
            GEO_PRIORITY.get(alert["geo_scope"], 9),
            SEVERITY_PRIORITY.get(alert["severity"], 9),
            -float(alert.get("confidence", 0)),
            0 if alert.get("kind") == "risk" else 1,
            alert["product_name"],
        )
    )
    return alerts
