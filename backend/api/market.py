"""Market prices route — production implementation.

GET /api/market/prices → latest mandi prices for shop's city/district.
Ref: BACKEND_STRUCTURE.md Section 4 (GET /api/market/prices)
"""
from fastapi import APIRouter, Depends
from sqlalchemy import select, distinct
from sqlalchemy.ext.asyncio import AsyncSession

from db.database import get_db
from db.models import Shop, MarketPrice
from core.auth_utils import get_current_user, TokenData

router = APIRouter()


@router.get("/prices")
async def get_market_prices(
    current_user: TokenData = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    shop_id = current_user.shop_id

    # Get shop's district
    shop_result = await db.execute(select(Shop).where(Shop.id == shop_id))
    shop = shop_result.scalar_one_or_none()
    district = shop.district if shop else "Nagpur"

    # Get latest price per commodity (most recent price_date)
    # Using subquery to get the max date per commodity
    result = await db.execute(
        select(MarketPrice)
        .where(MarketPrice.district == district)
        .order_by(MarketPrice.price_date.desc())
    )
    all_prices = result.scalars().all()

    # Deduplicate: keep only latest per commodity
    seen = set()
    prices = []
    for mp in all_prices:
        if mp.commodity in seen:
            continue
        seen.add(mp.commodity)
        prices.append({
            "commodity": mp.commodity,
            "price": round(mp.modal_price, 2),
            "min": round(mp.min_price, 2) if mp.min_price else None,
            "max": round(mp.max_price, 2) if mp.max_price else None,
            "unit": "kg",
            "source": mp.source,
            "updated_at": (mp.price_date.isoformat() if mp.price_date else None),
        })

    return {
        "city": district,
        "prices": prices,
    }
