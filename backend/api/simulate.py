"""Profit simulation route — production implementation.

POST /api/simulate → calculate profit impact of price change
Ref: BACKEND_STRUCTURE.md Section 9 (Profit Simulation Formula)
"""
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.database import get_db
from db.models import Product
from core.auth_utils import get_current_user, TokenData

router = APIRouter()

PRICE_ELASTICITY = 1.3  # Conservative grocery elasticity


class SimulateRequest(BaseModel):
    shop_id: int
    product_id: int
    action: str = "price_cut"
    current_price: float
    suggested_price: float
    avg_daily_qty: float


@router.post("/simulate")
async def simulate(
    req: SimulateRequest,
    current_user: TokenData = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Optionally fetch real cost_price from DB
    product_result = await db.execute(
        select(Product).where(Product.id == req.product_id)
    )
    product = product_result.scalar_one_or_none()
    cost_price = product.cost_price if product and product.cost_price else req.current_price * 0.85

    price_change_pct = (req.suggested_price - req.current_price) / req.current_price
    qty_change_pct = -price_change_pct * PRICE_ELASTICITY
    new_qty = req.avg_daily_qty * (1 + qty_change_pct)

    days = 7
    current_profit = (req.current_price - cost_price) * req.avg_daily_qty * days
    projected_profit = (req.suggested_price - cost_price) * new_qty * days
    delta = projected_profit - current_profit

    pct_change = round((delta / current_profit) * 100, 1) if current_profit else 0
    payback_days = max(1, round(abs(delta) / (projected_profit / days))) if projected_profit > 0 else 0

    direction = "extra" if delta > 0 else "less"
    price_diff = abs(req.current_price - req.suggested_price)
    action_word = "Reduce" if req.suggested_price < req.current_price else "Increase"

    return {
        "current_profit": round(current_profit),
        "projected_profit": round(projected_profit),
        "delta": round(delta),
        "pct_change": pct_change,
        "payback_days": payback_days,
        "summary": f"{action_word} price by ₹{price_diff:.0f}. Expected ₹{abs(delta):.0f} {direction} profit in {days} days.",
    }
