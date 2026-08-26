"""Forecast route - production implementation."""
from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from core.auth_utils import TokenData, get_current_user
from db.database import get_db
from db.models import MLForecast, Product
from ml.forecaster import refresh_forecasts_for_product

router = APIRouter()


@router.get("/forecast/{product_id_or_name}")
async def get_forecast(
    product_id_or_name: str,
    current_user: TokenData = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    shop_id = current_user.shop_id
    today = date.today()

    if product_id_or_name.isdigit():
        product_result = await db.execute(
            select(Product).where(and_(Product.id == int(product_id_or_name), Product.shop_id == shop_id))
        )
    else:
        product_result = await db.execute(
            select(Product).where(and_(Product.name.ilike(f"%{product_id_or_name}%"), Product.shop_id == shop_id))
        )
    product = product_result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    forecast_result = await db.execute(
        select(MLForecast)
        .where(
            and_(
                MLForecast.shop_id == shop_id,
                MLForecast.product_id == product.id,
                MLForecast.forecast_date >= today,
            )
        )
        .order_by(MLForecast.forecast_date.asc())
        .limit(30)
    )
    forecasts = forecast_result.scalars().all()

    if len(forecasts) < 30:
        await refresh_forecasts_for_product(shop_id, product.id, db, days=30)
        await db.commit()
        forecast_result = await db.execute(
            select(MLForecast)
            .where(
                and_(
                    MLForecast.shop_id == shop_id,
                    MLForecast.product_id == product.id,
                    MLForecast.forecast_date >= today,
                )
            )
            .order_by(MLForecast.forecast_date.asc())
            .limit(30)
        )
        forecasts = forecast_result.scalars().all()

    payload = [
        {
            "date": row.forecast_date.isoformat(),
            "predicted_qty": round(float(row.predicted_qty or 0), 1),
            "lower_bound": round(float(row.lower_bound or 0), 1) if row.lower_bound is not None else None,
            "upper_bound": round(float(row.upper_bound or 0), 1) if row.upper_bound is not None else None,
        }
        for row in forecasts
    ]

    return {
        "product_id": product.id,
        "product_name": product.name,
        "forecast_7d": payload[:7],
        "forecast_30d": payload,
        "is_anomaly": any(row.is_anomaly for row in forecasts),
        "anomaly_pct": round(max((float(row.anomaly_pct or 0) for row in forecasts), default=0.0), 1),
    }
