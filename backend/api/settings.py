"""Settings routes - profile and historical imports."""
from __future__ import annotations

import csv
import hashlib
import io
from datetime import date

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel, field_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.auth_utils import TokenData, get_current_user
from db.database import get_db
from db.models import Product, Shop, ShopNotificationSettings, User
from ml.forecaster import retrain_for_shop
from services.inventory import upsert_sales_entry_and_adjust_stock
from services.alerts import compute_shop_alerts
from services.whatsapp_alerts import send_test_whatsapp_alert

router = APIRouter()

_csv_temp_store: dict[str, list[dict]] = {}


def _parse_tabular_upload(content: bytes) -> tuple[str, list[dict], dict[str, str]]:
    try:
        text = content.decode("utf-8")
    except UnicodeDecodeError:
        text = content.decode("latin-1")

    reader = csv.DictReader(io.StringIO(text))
    rows = list(reader)
    if not rows:
        raise HTTPException(status_code=400, detail="CSV file is empty")

    columns = list(rows[0].keys())
    detected: dict[str, str] = {}
    for col in columns:
        col_lower = col.lower().strip()
        if "date" in col_lower:
            detected["date"] = col
        elif "product" in col_lower or "item" in col_lower or "name" in col_lower:
            detected["product"] = col
        elif "qty" in col_lower or "quantity" in col_lower:
            detected["qty"] = col
        elif "price" in col_lower or "revenue" in col_lower or "amount" in col_lower:
            detected["price"] = col

    file_id = hashlib.md5(content[:1000]).hexdigest()[:12]
    _csv_temp_store[file_id] = rows
    return file_id, rows, detected


class SettingsProfileUpdate(BaseModel):
    shop_name: str
    city: str
    state: str
    gstin: str | None = None
    language: str = "en"
    categories: list[str] = []
    whatsapp_alerts_enabled: bool | None = None
    whatsapp_phone_override: str | None = None

    @field_validator("language")
    @classmethod
    def validate_language(cls, value: str) -> str:
        if value not in {"en", "hi", "te"}:
            raise ValueError("language must be one of en, hi, te")
        return value

    @field_validator("whatsapp_phone_override")
    @classmethod
    def validate_whatsapp_phone_override(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = value.strip()
        if not cleaned:
            return None
        digits = "".join(ch for ch in cleaned if ch.isdigit())
        if len(digits) not in {10, 12, 13, 14, 15}:
            raise ValueError("Enter a valid WhatsApp phone number")
        return cleaned


class ConfirmCSVRequest(BaseModel):
    file_id: str
    column_mapping: dict[str, str]
    source: str = "csv"

    @field_validator("source")
    @classmethod
    def validate_source(cls, value: str) -> str:
        if value not in {"csv", "ocr"}:
            raise ValueError("source must be csv or ocr")
        return value


@router.get("/profile")
async def get_profile(
    current_user: TokenData = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    user_result = await db.execute(select(User).where(User.id == current_user.user_id))
    user = user_result.scalar_one_or_none()
    shop_result = await db.execute(select(Shop).where(Shop.id == current_user.shop_id))
    shop = shop_result.scalar_one_or_none()
    notification_result = await db.execute(
        select(ShopNotificationSettings).where(ShopNotificationSettings.shop_id == current_user.shop_id)
    )
    notification_settings = notification_result.scalar_one_or_none()
    if not user or not shop:
        raise HTTPException(status_code=404, detail="Profile not found")

    return {
        "user": {
            "id": user.id,
            "name": user.name,
            "phone": user.phone,
            "language": user.language,
            "city": user.city,
            "state": user.state,
        },
        "shop": {
            "id": shop.id,
            "shop_name": shop.shop_name,
            "gstin": shop.gstin,
            "city": shop.district,
            "state": user.state,
            "categories": shop.categories or [],
            "cold_start_path": shop.cold_start_path,
            "data_maturity_days": shop.data_maturity_days or 0,
        },
        "notifications": {
            "whatsapp_alerts_enabled": notification_settings.whatsapp_alerts_enabled if notification_settings else False,
            "recipient_phone": notification_settings.whatsapp_phone_override if notification_settings and notification_settings.whatsapp_phone_override else user.phone,
            "owner_phone": user.phone,
            "phone_override": notification_settings.whatsapp_phone_override if notification_settings else None,
        },
    }


@router.put("/profile")
async def update_profile(
    req: SettingsProfileUpdate,
    current_user: TokenData = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    user_result = await db.execute(select(User).where(User.id == current_user.user_id))
    user = user_result.scalar_one_or_none()
    shop_result = await db.execute(select(Shop).where(Shop.id == current_user.shop_id))
    shop = shop_result.scalar_one_or_none()
    notification_result = await db.execute(
        select(ShopNotificationSettings).where(ShopNotificationSettings.shop_id == current_user.shop_id)
    )
    notification_settings = notification_result.scalar_one_or_none()
    if not user or not shop:
        raise HTTPException(status_code=404, detail="Profile not found")

    user.language = req.language
    user.city = req.city
    user.state = req.state
    shop.shop_name = req.shop_name
    shop.gstin = req.gstin
    shop.district = req.city
    shop.categories = req.categories

    if req.whatsapp_alerts_enabled is not None:
        if not notification_settings:
            notification_settings = ShopNotificationSettings(shop_id=current_user.shop_id)
            db.add(notification_settings)
        notification_settings.whatsapp_alerts_enabled = req.whatsapp_alerts_enabled
    if req.whatsapp_phone_override is not None or notification_settings:
        if not notification_settings:
            notification_settings = ShopNotificationSettings(shop_id=current_user.shop_id)
            db.add(notification_settings)
        notification_settings.whatsapp_phone_override = req.whatsapp_phone_override

    await db.commit()

    return {"status": "updated"}


@router.post("/csv")
async def upload_csv(
    file: UploadFile = File(...),
    current_user: TokenData = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    del current_user, db
    content = await file.read()
    file_id, rows, detected = _parse_tabular_upload(content)

    return {
        "file_id": file_id,
        "preview_rows": rows[:5],
        "detected_columns": detected,
        "row_count": len(rows),
    }


@router.post("/ocr")
async def upload_ocr_bill(
    file: UploadFile = File(...),
    current_user: TokenData = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    del current_user, db
    content = await file.read()
    file_id, rows, detected = _parse_tabular_upload(content)
    return {
        "file_id": file_id,
        "preview_rows": rows[:5],
        "detected_columns": detected,
        "row_count": len(rows),
        "ingestion_mode": "ocr",
    }


@router.post("/csv/confirm")
async def confirm_csv_import(
    req: ConfirmCSVRequest,
    current_user: TokenData = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    rows = _csv_temp_store.pop(req.file_id, None)
    if not rows:
        raise HTTPException(status_code=404, detail="File not found - please re-upload")

    shop_id = current_user.shop_id
    mapping = req.column_mapping
    date_col = mapping.get("date", "date")
    product_col = mapping.get("product", "product")
    qty_col = mapping.get("qty", "qty")
    price_col = mapping.get("price", "price")

    result = await db.execute(select(Product).where(Product.shop_id == shop_id))
    products = result.scalars().all()
    existing_products = {product.name.strip().lower(): product for product in products}

    imported = 0
    for row in rows:
        product_name = str(row.get(product_col, "")).strip()
        if not product_name:
            continue

        product = existing_products.get(product_name.lower())
        if not product:
            selling_price = float(row.get(price_col, 0) or 0)
            product = Product(
                shop_id=shop_id,
                name=product_name,
                category="general",
                unit="kg",
                selling_price=selling_price,
            )
            db.add(product)
            await db.flush()
            existing_products[product_name.lower()] = product

        try:
            entry_date = date.fromisoformat(str(row.get(date_col, "")).strip())
        except (TypeError, ValueError):
            continue

        qty = float(row.get(qty_col, 0) or 0)
        price = float(row.get(price_col, 0) or 0)
        if qty <= 0:
            continue

        revenue = qty * price
        await upsert_sales_entry_and_adjust_stock(
            db,
            shop_id=shop_id,
            product_id=product.id,
            entry_date=entry_date,
            quantity_sold=qty,
            revenue=revenue,
            source=req.source,
        )
        imported += 1

    shop_result = await db.execute(select(Shop).where(Shop.id == shop_id))
    shop = shop_result.scalar_one_or_none()
    if shop:
        shop.data_maturity_days = max(shop.data_maturity_days or 0, imported // 5)
        if req.source in {"csv", "ocr"}:
            shop.cold_start_path = req.source

    await db.commit()

    retrain_triggered = imported > 0
    if retrain_triggered:
        await retrain_for_shop(shop_id, db)

    return {
        "imported_count": imported,
        "ml_retrain_triggered": retrain_triggered,
        "source": req.source,
    }


class VoiceJournalRequest(BaseModel):
    notes: list[str]


@router.post("/voice-journal")
async def save_voice_journal_onboarding(
    req: VoiceJournalRequest,
    current_user: TokenData = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    shop_result = await db.execute(select(Shop).where(Shop.id == current_user.shop_id))
    shop = shop_result.scalar_one_or_none()
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")

    shop.cold_start_path = "voice"
    await db.commit()

    return {
        "saved_notes": len([note for note in req.notes if note.strip()]),
        "cold_start_path": shop.cold_start_path,
    }


@router.post("/whatsapp/test")
async def send_whatsapp_test(
    current_user: TokenData = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    alerts = await compute_shop_alerts(db, current_user.shop_id, refresh_news=False)
    try:
        result = await send_test_whatsapp_alert(db, shop_id=current_user.shop_id, alerts=alerts)
    except RuntimeError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return result
