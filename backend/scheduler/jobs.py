"""APScheduler background jobs."""
from __future__ import annotations

import os
from datetime import date

import httpx
from sqlalchemy import and_, select

from db.database import async_session
from db.models import MarketPrice, Product, Shop

AGMARKNET_API_KEY = os.getenv("AGMARKNET_API_KEY", "")
AGMARKNET_BASE_URL = os.getenv("AGMARKNET_BASE_URL", "https://api.data.gov.in/resource")
AGMARKNET_RESOURCE_ID = os.getenv("AGMARKNET_RESOURCE_ID", "")
TAVILY_API_KEY = os.getenv("TAVILY_API_KEY", "")
TAVILY_SEARCH_URL = "https://api.tavily.com/search"


async def _fetch_agmarknet_rows(district: str, commodity: str) -> list[dict]:
    if not AGMARKNET_API_KEY or not AGMARKNET_RESOURCE_ID:
        return []

    params = {
        "api-key": AGMARKNET_API_KEY,
        "format": "json",
        "limit": 10,
        "filters[district]": district,
        "filters[commodity]": commodity,
    }
    url = f"{AGMARKNET_BASE_URL.rstrip('/')}/{AGMARKNET_RESOURCE_ID}"

    try:
        async with httpx.AsyncClient(timeout=20) as client:
            response = await client.get(url, params=params)
            if response.status_code == 200:
                payload = response.json()
                return payload.get("records", []) if isinstance(payload, dict) else []
            print(f"[Scheduler] Agmarknet returned {response.status_code} for {district}/{commodity}")
    except Exception as exc:
        print(f"[Scheduler] Agmarknet error for {district}/{commodity}: {exc}")
    return []


def _parse_price(value) -> float | None:
    try:
        return float(str(value).replace(",", "").strip())
    except Exception:
        return None


async def refresh_agmarknet():
    print("[Scheduler] Refreshing Agmarknet prices...")

    async with async_session() as db:
        shops_result = await db.execute(select(Shop))
        shops = shops_result.scalars().all()
        districts = {shop.district for shop in shops if shop.district}

        for district in districts:
            products_result = await db.execute(
                select(Product).where(and_(Product.shop_id.in_([shop.id for shop in shops if shop.district == district])))
            )
            products = products_result.scalars().all()
            commodities = {
                (product.agmarknet_commodity or product.name).strip()
                for product in products
                if (product.agmarknet_commodity or product.name)
            }

            for commodity in commodities:
                rows = await _fetch_agmarknet_rows(district, commodity)
                if not rows:
                    continue

                for row in rows[:3]:
                    modal = _parse_price(row.get("modal_price") or row.get("modal") or row.get("modal price"))
                    if modal is None:
                        continue
                    min_price = _parse_price(row.get("min_price") or row.get("min"))
                    max_price = _parse_price(row.get("max_price") or row.get("max"))
                    state = str(row.get("state") or row.get("state_name") or "")
                    date_text = str(row.get("arrival_date") or row.get("price_date") or date.today().isoformat())
                    try:
                        price_date = date.fromisoformat(date_text[:10])
                    except ValueError:
                        price_date = date.today()

                    existing = await db.execute(
                        select(MarketPrice).where(
                            and_(
                                MarketPrice.commodity == commodity,
                                MarketPrice.district == district,
                                MarketPrice.price_date == price_date,
                                MarketPrice.source == "agmarknet",
                            )
                        )
                    )
                    current = existing.scalar_one_or_none()
                    if current:
                        current.modal_price = modal
                        current.min_price = min_price
                        current.max_price = max_price
                        current.state = state
                        current.confidence = 1.0
                    else:
                        db.add(
                            MarketPrice(
                                commodity=commodity,
                                district=district,
                                state=state,
                                modal_price=modal,
                                min_price=min_price,
                                max_price=max_price,
                                price_date=price_date,
                                source="agmarknet",
                                confidence=1.0,
                            )
                        )

        await db.commit()


async def refresh_tavily():
    print("[Scheduler] Refreshing competitor intelligence...")

    if not TAVILY_API_KEY:
        return

    async with async_session() as db:
        result = await db.execute(select(Shop))
        shops = result.scalars().all()

        for shop in shops:
            try:
                async with httpx.AsyncClient(timeout=15) as client:
                    response = await client.post(
                        TAVILY_SEARCH_URL,
                        json={
                            "api_key": TAVILY_API_KEY,
                            "query": f"kirana grocery price competition {shop.district}",
                            "search_depth": "basic",
                            "max_results": 2,
                        },
                    )
                    if response.status_code == 200:
                        print(f"[Scheduler] Got competitor data for {shop.shop_name}")
            except Exception as exc:
                print(f"[Scheduler] Tavily error: {exc}")


async def check_and_fire_alerts():
    print("[Scheduler] Checking risk alerts...")

    from services.alerts import compute_shop_alerts
    from services.whatsapp_alerts import dispatch_whatsapp_alerts
    from ws.dashboard_handler import broadcast_to_shop

    async with async_session() as db:
        result = await db.execute(select(Shop))
        shops = result.scalars().all()

        for shop in shops:
            alerts = await compute_shop_alerts(db, shop.id, refresh_news=True)
            for alert in alerts:
                await broadcast_to_shop(shop.id, {"type": "alert", "payload": alert})
            try:
                delivery = await dispatch_whatsapp_alerts(db, shop_id=shop.id, alerts=alerts)
                if delivery["sent"] or delivery["digests"]:
                    print(
                        f"[WhatsApp] Sent {delivery['sent']} urgent alert(s) and {delivery['digests']} digest(s) for shop {shop.id}"
                    )
            except Exception as exc:
                print(f"[WhatsApp] Failed for shop {shop.id}: {exc}")
            if alerts:
                print(f"[Alert] Broadcast {len(alerts)} alert(s) for shop {shop.id}")


def start_scheduler():
    try:
        from apscheduler.schedulers.asyncio import AsyncIOScheduler

        scheduler = AsyncIOScheduler()
        scheduler.add_job(refresh_agmarknet, "interval", hours=4, id="agmarknet_refresh")
        scheduler.add_job(refresh_tavily, "interval", hours=4, id="tavily_cache")
        scheduler.add_job(check_and_fire_alerts, "interval", minutes=30, id="alert_checker")
        scheduler.start()
        print("[Scheduler] APScheduler started with 3 jobs")
        return scheduler
    except ImportError:
        print("[Scheduler] APScheduler not installed - background jobs disabled")
        return None
