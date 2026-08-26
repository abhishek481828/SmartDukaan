"""Sales entry route - production implementation."""
from __future__ import annotations

import asyncio
from datetime import date

from fastapi import APIRouter, Depends, status
from pydantic import BaseModel, field_validator
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from core.auth_utils import TokenData, get_current_user
from db.database import async_session, get_db
from db.models import SalesEntry, Shop
from ml.forecaster import retrain_for_shop
from services.inventory import upsert_sales_entry_and_adjust_stock

router = APIRouter()


class SalesEntryItem(BaseModel):
    product_id: int
    entry_date: str
    quantity_sold: float
    revenue: float

    @field_validator("quantity_sold")
    @classmethod
    def validate_qty(cls, value: float) -> float:
        if value <= 0 or value > 10000:
            raise ValueError("Quantity must be between 0 and 10,000")
        return value

    @field_validator("revenue")
    @classmethod
    def validate_revenue(cls, value: float) -> float:
        if value < 0 or value > 1_000_000:
            raise ValueError("Revenue must be between 0 and 1,000,000")
        return value


class SalesEntryRequest(BaseModel):
    entries: list[SalesEntryItem]
    source: str = "voice"

    @field_validator("source")
    @classmethod
    def validate_source(cls, value: str) -> str:
        if value not in {"voice", "csv", "ocr", "manual", "benchmark"}:
            raise ValueError("Source must be one of: voice, csv, ocr, manual, benchmark")
        return value


async def _run_retrain_job(shop_id: int):
    async with async_session() as session:
        try:
            await retrain_for_shop(shop_id, session)
        except Exception as exc:
            await session.rollback()
            print(f"[Sales] ML retrain failed for shop {shop_id}: {exc}")


@router.post("/entry", status_code=status.HTTP_201_CREATED)
async def log_sales_entry(
    req: SalesEntryRequest,
    current_user: TokenData = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    shop_id = current_user.shop_id
    saved = 0

    for item in req.entries:
        entry_date = date.fromisoformat(item.entry_date)
        await upsert_sales_entry_and_adjust_stock(
            db,
            shop_id=shop_id,
            product_id=item.product_id,
            entry_date=entry_date,
            quantity_sold=item.quantity_sold,
            revenue=item.revenue,
            source=req.source,
        )
        saved += 1

    shop_result = await db.execute(select(Shop).where(Shop.id == shop_id))
    shop = shop_result.scalar_one_or_none()
    if shop:
        shop.data_maturity_days = (shop.data_maturity_days or 0) + 1

    await db.commit()

    count_result = await db.execute(select(func.count(SalesEntry.id)).where(SalesEntry.shop_id == shop_id))
    total_entries = count_result.scalar() or 0
    retrain_triggered = total_entries >= 5 and total_entries % 5 == 0

    if retrain_triggered:
        asyncio.create_task(_run_retrain_job(shop_id))

    return {
        "saved": saved,
        "retrain_triggered": retrain_triggered,
        "total_entries": int(total_entries),
    }
