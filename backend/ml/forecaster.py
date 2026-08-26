"""XGBoost demand forecaster - production implementation."""
from __future__ import annotations

import math
import os
import pickle
from datetime import date, timedelta
from pathlib import Path

import numpy as np
import pandas as pd
from sqlalchemy import and_, delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from db.models import MLForecast, Product, SalesEntry

MODELS_DIR = Path(os.path.dirname(__file__)) / "models"
MODELS_DIR.mkdir(exist_ok=True)

XGBOOST_PARAMS = {
    "n_estimators": 100,
    "max_depth": 4,
    "learning_rate": 0.1,
    "objective": "reg:squarederror",
    "tree_method": "hist",
}

FEATURE_COLS = [
    "day_of_week",
    "month",
    "week_of_year",
    "lag_1",
    "lag_7",
    "lag_30",
    "rolling_mean_7",
    "rolling_mean_30",
]


def _build_features(df: pd.DataFrame) -> pd.DataFrame:
    df = df.sort_values("entry_date").copy()
    df["day_of_week"] = df["entry_date"].dt.dayofweek
    df["month"] = df["entry_date"].dt.month
    df["week_of_year"] = df["entry_date"].dt.isocalendar().week.astype(int)
    df["lag_1"] = df["quantity_sold"].shift(1)
    df["lag_7"] = df["quantity_sold"].shift(7)
    df["lag_30"] = df["quantity_sold"].shift(30)
    df["rolling_mean_7"] = df["quantity_sold"].rolling(7, min_periods=1).mean()
    df["rolling_mean_30"] = df["quantity_sold"].rolling(30, min_periods=1).mean()
    return df.fillna(0)


async def train_model(shop_id: int, product_id: int, db: AsyncSession) -> bool:
    try:
        from xgboost import XGBRegressor
    except ImportError:
        print("[ML] xgboost not installed - skipping training")
        return False

    result = await db.execute(
        select(SalesEntry)
        .where(and_(SalesEntry.shop_id == shop_id, SalesEntry.product_id == product_id))
        .order_by(SalesEntry.entry_date)
    )
    rows = result.scalars().all()
    if len(rows) < 7:
        print(f"[ML] Not enough data for product {product_id} ({len(rows)} rows)")
        return False

    df = pd.DataFrame(
        [{
            "entry_date": pd.Timestamp(r.entry_date),
            "quantity_sold": float(r.quantity_sold),
            "revenue": float(r.revenue),
        } for r in rows]
    )
    df = _build_features(df)

    X = df[FEATURE_COLS].values
    y = df["quantity_sold"].values

    model = XGBRegressor(**XGBOOST_PARAMS)
    model.fit(X, y)

    model_path = MODELS_DIR / f"shop_{shop_id}_product_{product_id}.pkl"
    with open(model_path, "wb") as handle:
        pickle.dump(model, handle)

    print(f"[ML] Model trained for shop={shop_id}, product={product_id}")
    return True


def _load_model(shop_id: int, product_id: int):
    model_path = MODELS_DIR / f"shop_{shop_id}_product_{product_id}.pkl"
    if not model_path.exists():
        return None
    try:
        with open(model_path, "rb") as handle:
            return pickle.load(handle)
    except Exception:
        return None


async def predict_days(shop_id: int, product_id: int, db: AsyncSession, days: int = 7) -> list[dict]:
    model = _load_model(shop_id, product_id)
    today = date.today()
    result = await db.execute(
        select(SalesEntry)
        .where(and_(SalesEntry.shop_id == shop_id, SalesEntry.product_id == product_id))
        .order_by(SalesEntry.entry_date.desc())
        .limit(30)
    )
    recent = list(reversed(result.scalars().all()))
    if not recent:
        return _benchmark_forecast(today, days=days)

    qty_series = [float(row.quantity_sold) for row in recent]
    forecasts: list[dict] = []

    for offset in range(1, days + 1):
        forecast_date = today + timedelta(days=offset)
        history_floor = qty_series[0] if qty_series else 0
        features = {
            "day_of_week": forecast_date.weekday(),
            "month": forecast_date.month,
            "week_of_year": forecast_date.isocalendar()[1],
            "lag_1": qty_series[-1] if qty_series else 0,
            "lag_7": qty_series[-7] if len(qty_series) >= 7 else history_floor,
            "lag_30": qty_series[-30] if len(qty_series) >= 30 else history_floor,
            "rolling_mean_7": float(np.mean(qty_series[-7:])) if qty_series else 0,
            "rolling_mean_30": float(np.mean(qty_series[-30:])) if qty_series else 0,
        }

        X = np.array([[features[col] for col in FEATURE_COLS]])
        predicted = float(model.predict(X)[0]) if model is not None else float(np.mean(qty_series[-7:]))
        predicted = max(0.0, round(predicted, 1))
        lower = round(max(0.0, predicted * 0.82), 1)
        upper = round(max(predicted, predicted * 1.18), 1)

        forecasts.append({
            "date": forecast_date.isoformat(),
            "predicted_qty": predicted,
            "lower_bound": lower,
            "upper_bound": upper,
        })
        qty_series.append(predicted)

    return forecasts


async def predict_7d(shop_id: int, product_id: int, db: AsyncSession) -> list[dict]:
    return await predict_days(shop_id, product_id, db, days=7)


def _benchmark_forecast(today: date, days: int = 7) -> list[dict]:
    base = 15.0
    forecasts: list[dict] = []
    for offset in range(1, days + 1):
        seasonal = 1 + (math.sin(offset / 2.5) * 0.08)
        predicted = round(base * seasonal, 1)
        forecasts.append({
            "date": (today + timedelta(days=offset)).isoformat(),
            "predicted_qty": predicted,
            "lower_bound": round(max(0.0, predicted * 0.8), 1),
            "upper_bound": round(predicted * 1.2, 1),
        })
    return forecasts


async def refresh_forecasts_for_product(shop_id: int, product_id: int, db: AsyncSession, days: int = 30) -> list[dict]:
    forecasts = await predict_days(shop_id, product_id, db, days=days)
    today = date.today()

    await db.execute(
        delete(MLForecast).where(
            and_(
                MLForecast.shop_id == shop_id,
                MLForecast.product_id == product_id,
                MLForecast.forecast_date >= today,
            )
        )
    )

    for item in forecasts:
        db.add(
            MLForecast(
                shop_id=shop_id,
                product_id=product_id,
                forecast_date=date.fromisoformat(item["date"]),
                predicted_qty=item["predicted_qty"],
                lower_bound=item["lower_bound"],
                upper_bound=item["upper_bound"],
                is_anomaly=False,
                anomaly_pct=0,
                model_version="xgb-v1",
            )
        )

    await db.flush()
    return forecasts


async def retrain_for_shop(shop_id: int, db: AsyncSession):
    sales_activity = (
        select(
            SalesEntry.product_id.label("product_id"),
            func.count(SalesEntry.id).label("sales_count"),
        )
        .where(SalesEntry.shop_id == shop_id)
        .group_by(SalesEntry.product_id)
        .subquery()
    )

    result = await db.execute(
        select(Product)
        .outerjoin(sales_activity, sales_activity.c.product_id == Product.id)
        .where(
            and_(
                Product.shop_id == shop_id,
                (Product.stock_qty > 0) | (func.coalesce(sales_activity.c.sales_count, 0) > 0),
            )
        )
    )
    products = result.scalars().all()

    for product in products:
        await train_model(shop_id, product.id, db)
        await refresh_forecasts_for_product(shop_id, product.id, db, days=30)

    await db.commit()
    print(f"[ML] Retrained all models for shop {shop_id}")
