"""SQLAlchemy ORM models — 7 tables matching BACKEND_STRUCTURE.md

Source of truth: BACKEND_STRUCTURE.md Section 2.
All tables use snake_case, have id + created_at + updated_at.
"""
from datetime import datetime, timezone
from sqlalchemy import (
    Column, Integer, String, Float, Text, Boolean, DateTime, Date,
    ForeignKey, UniqueConstraint, Index, JSON
)
from db.database import Base


def _utcnow():
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, autoincrement=True)
    phone = Column(String(15), unique=True, nullable=False, index=True)
    name = Column(String(255), nullable=False)
    password_hash = Column(String(255), nullable=False)
    city = Column(String(100), nullable=False)
    state = Column(String(100), nullable=False)
    language = Column(String(10), default="en")
    is_onboarded = Column(Boolean, default=False)
    created_at = Column(DateTime, default=_utcnow)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow)


class Shop(Base):
    __tablename__ = "shops"
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    shop_name = Column(String(255), nullable=False)
    gstin = Column(String(20), nullable=True)
    categories = Column(JSON, nullable=False, default=list)
    district = Column(String(100), nullable=False, default="")
    cold_start_path = Column(String(20), default="benchmark")
    data_maturity_days = Column(Integer, default=0)
    created_at = Column(DateTime, default=_utcnow)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow)

    __table_args__ = (
        Index("idx_shops_user_id", "user_id"),
    )


class Product(Base):
    __tablename__ = "products"
    id = Column(Integer, primary_key=True, autoincrement=True)
    shop_id = Column(Integer, ForeignKey("shops.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(255), nullable=False)
    name_hindi = Column(String(255), nullable=True)
    category = Column(String(50), nullable=False)
    unit = Column(String(20), default="kg")
    selling_price = Column(Float, nullable=False)
    cost_price = Column(Float, nullable=True)
    stock_qty = Column(Float, default=0)
    agmarknet_commodity = Column(String(100), nullable=True)
    created_at = Column(DateTime, default=_utcnow)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow)

    __table_args__ = (
        Index("idx_products_shop_id", "shop_id"),
        Index("idx_products_category", "category"),
    )


class StockTransaction(Base):
    __tablename__ = "stock_transactions"
    id = Column(Integer, primary_key=True, autoincrement=True)
    shop_id = Column(Integer, ForeignKey("shops.id", ondelete="CASCADE"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False)
    transaction_type = Column(String(32), nullable=False)
    quantity_delta = Column(Float, nullable=False)
    balance_after = Column(Float, nullable=False)
    unit_price = Column(Float, nullable=True)
    reference_type = Column(String(32), nullable=True)
    reference_id = Column(Integer, nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=_utcnow)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow)

    __table_args__ = (
        Index("idx_stock_transactions_shop_product_date", "shop_id", "product_id", "created_at"),
        Index("idx_stock_transactions_reference", "reference_type", "reference_id"),
    )


class SalesEntry(Base):
    __tablename__ = "sales_entries"
    id = Column(Integer, primary_key=True, autoincrement=True)
    shop_id = Column(Integer, ForeignKey("shops.id", ondelete="CASCADE"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False)
    entry_date = Column(Date, nullable=False)
    quantity_sold = Column(Float, nullable=False)
    revenue = Column(Float, nullable=False)
    entry_source = Column(String(20), default="voice")
    created_at = Column(DateTime, default=_utcnow)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow)

    __table_args__ = (
        UniqueConstraint("shop_id", "product_id", "entry_date", name="uq_sales_shop_product_date"),
        Index("idx_sales_shop_product_date", "shop_id", "product_id", "entry_date"),
        Index("idx_sales_entry_date", "entry_date"),
    )


class MarketPrice(Base):
    __tablename__ = "market_prices"
    id = Column(Integer, primary_key=True, autoincrement=True)
    commodity = Column(String(100), nullable=False)
    district = Column(String(100), nullable=False)
    state = Column(String(100), nullable=False, default="")
    modal_price = Column(Float, nullable=False)
    min_price = Column(Float, nullable=True)
    max_price = Column(Float, nullable=True)
    price_date = Column(Date, nullable=False)
    source = Column(String(20), default="agmarknet")
    confidence = Column(Float, default=1.0)
    created_at = Column(DateTime, default=_utcnow)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow)

    __table_args__ = (
        Index("idx_market_commodity_district_date", "commodity", "district", "price_date"),
    )


class MLForecast(Base):
    __tablename__ = "ml_forecasts"
    id = Column(Integer, primary_key=True, autoincrement=True)
    shop_id = Column(Integer, ForeignKey("shops.id", ondelete="CASCADE"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False)
    forecast_date = Column(Date, nullable=False)
    predicted_qty = Column(Float, nullable=False)
    lower_bound = Column(Float, nullable=True)
    upper_bound = Column(Float, nullable=True)
    is_anomaly = Column(Boolean, default=False)
    anomaly_pct = Column(Float, default=0)
    model_version = Column(String(20), default="xgb-v1")
    created_at = Column(DateTime, default=_utcnow)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow)

    __table_args__ = (
        Index("idx_forecasts_shop_product_date", "shop_id", "product_id", "forecast_date"),
    )


class NewsSignalCache(Base):
    __tablename__ = "news_signal_cache"
    id = Column(Integer, primary_key=True, autoincrement=True)
    shop_id = Column(Integer, ForeignKey("shops.id", ondelete="CASCADE"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False)
    geo_scope = Column(String(20), nullable=False)
    signal_kind = Column(String(20), nullable=False)
    signal_source = Column(String(20), default="news")
    title = Column(String(255), nullable=True)
    summary = Column(Text, nullable=True)
    action_hint = Column(Text, nullable=True)
    signal_strength = Column(Float, default=0)
    confidence = Column(Float, default=0)
    urls = Column(JSON, nullable=False, default=list)
    freshness_hours = Column(Integer, default=6)
    expires_at = Column(DateTime, nullable=True)
    fetched_at = Column(DateTime, default=_utcnow)
    created_at = Column(DateTime, default=_utcnow)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow)

    __table_args__ = (
        UniqueConstraint("shop_id", "product_id", "geo_scope", name="uq_news_signal_shop_product_geo"),
        Index("idx_news_signal_shop_product", "shop_id", "product_id"),
        Index("idx_news_signal_expires_at", "expires_at"),
    )


class Invoice(Base):
    __tablename__ = "invoices"
    id = Column(Integer, primary_key=True, autoincrement=True)
    shop_id = Column(Integer, ForeignKey("shops.id", ondelete="CASCADE"), nullable=False)
    invoice_number = Column(String(50), unique=True, nullable=False)
    customer_name = Column(String(255), nullable=False)
    customer_gstin = Column(String(20), nullable=True)
    items = Column(JSON, nullable=False)
    subtotal = Column(Float, nullable=False)
    cgst = Column(Float, nullable=False)
    sgst = Column(Float, nullable=False)
    total = Column(Float, nullable=False)
    pdf_path = Column(Text, nullable=True)
    created_at = Column(DateTime, default=_utcnow)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow)

    __table_args__ = (
        Index("idx_invoices_shop_id", "shop_id"),
    )


class ShopNotificationSettings(Base):
    __tablename__ = "shop_notification_settings"
    id = Column(Integer, primary_key=True, autoincrement=True)
    shop_id = Column(Integer, ForeignKey("shops.id", ondelete="CASCADE"), nullable=False, unique=True)
    whatsapp_alerts_enabled = Column(Boolean, default=False)
    whatsapp_phone_override = Column(String(24), nullable=True)
    created_at = Column(DateTime, default=_utcnow)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow)

    __table_args__ = (
        Index("idx_shop_notification_settings_shop_id", "shop_id"),
    )


class AlertNotificationState(Base):
    __tablename__ = "alert_notification_states"
    id = Column(Integer, primary_key=True, autoincrement=True)
    shop_id = Column(Integer, ForeignKey("shops.id", ondelete="CASCADE"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=True)
    channel = Column(String(20), nullable=False, default="whatsapp")
    notification_key = Column(String(255), nullable=False)
    alert_kind = Column(String(20), nullable=False)
    signal_source = Column(String(32), nullable=False)
    geo_scope = Column(String(20), nullable=True)
    severity = Column(String(20), nullable=False)
    message_hash = Column(String(64), nullable=False)
    latest_message = Column(Text, nullable=True)
    latest_action_hint = Column(Text, nullable=True)
    active = Column(Boolean, default=True)
    first_seen_at = Column(DateTime, default=_utcnow)
    last_seen_at = Column(DateTime, default=_utcnow)
    cleared_at = Column(DateTime, nullable=True)
    last_whatsapp_sent_at = Column(DateTime, nullable=True)
    last_delivery_status = Column(String(32), nullable=True)
    last_message_sid = Column(String(64), nullable=True)
    created_at = Column(DateTime, default=_utcnow)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow)

    __table_args__ = (
        UniqueConstraint("shop_id", "channel", "notification_key", name="uq_alert_notification_state_shop_channel_key"),
        Index("idx_alert_notification_state_shop_id", "shop_id"),
        Index("idx_alert_notification_state_active", "shop_id", "active"),
    )
