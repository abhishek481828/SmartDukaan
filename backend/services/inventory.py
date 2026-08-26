"""Shared inventory and sales mutation helpers."""
from __future__ import annotations

from datetime import date, timedelta
from typing import Literal

from fastapi import HTTPException
from sqlalchemy import Select, and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from db.models import Product, SalesEntry, StockTransaction

TransactionType = Literal["sale", "restock", "manual_adjustment", "invoice_sale"]


async def get_product_or_404(db: AsyncSession, shop_id: int, product_id: int) -> Product:
    result = await db.execute(
        select(Product).where(Product.id == product_id, Product.shop_id == shop_id)
    )
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product


async def find_product_by_name(db: AsyncSession, shop_id: int, product_name: str) -> Product | None:
    normalized = product_name.strip().lower()
    if not normalized:
        return None

    result = await db.execute(select(Product).where(Product.shop_id == shop_id))
    products = result.scalars().all()

    for product in products:
        if product.name.strip().lower() == normalized:
            return product

    for product in products:
        name = product.name.strip().lower()
        if normalized in name or name in normalized:
            return product

    return None


async def apply_stock_change(
    db: AsyncSession,
    *,
    shop_id: int,
    product_id: int,
    quantity_delta: float,
    transaction_type: TransactionType,
    unit_price: float | None = None,
    reference_type: str | None = None,
    reference_id: int | None = None,
    notes: str | None = None,
    allow_negative: bool = False,
) -> StockTransaction:
    product = await get_product_or_404(db, shop_id, product_id)
    current_stock = float(product.stock_qty or 0)
    next_stock = round(current_stock + quantity_delta, 3)

    if not allow_negative and next_stock < 0:
        raise HTTPException(
            status_code=400,
            detail=f"Insufficient stock for {product.name}. Available: {current_stock:g}",
        )

    product.stock_qty = next_stock
    transaction = StockTransaction(
        shop_id=shop_id,
        product_id=product_id,
        transaction_type=transaction_type,
        quantity_delta=round(quantity_delta, 3),
        balance_after=next_stock,
        unit_price=unit_price,
        reference_type=reference_type,
        reference_id=reference_id,
        notes=notes,
    )
    db.add(transaction)
    await db.flush()
    return transaction


async def upsert_sales_entry_and_adjust_stock(
    db: AsyncSession,
    *,
    shop_id: int,
    product_id: int,
    entry_date: date,
    quantity_sold: float,
    revenue: float,
    source: str,
) -> tuple[SalesEntry, float]:
    product = await get_product_or_404(db, shop_id, product_id)
    existing_result = await db.execute(
        select(SalesEntry).where(
            SalesEntry.shop_id == shop_id,
            SalesEntry.product_id == product_id,
            SalesEntry.entry_date == entry_date,
        )
    )
    row = existing_result.scalar_one_or_none()
    previous_qty = float(row.quantity_sold) if row else 0.0

    if row:
        row.quantity_sold = quantity_sold
        row.revenue = revenue
        row.entry_source = source
        sales_entry = row
    else:
        sales_entry = SalesEntry(
            shop_id=shop_id,
            product_id=product_id,
            entry_date=entry_date,
            quantity_sold=quantity_sold,
            revenue=revenue,
            entry_source=source,
        )
        db.add(sales_entry)
        await db.flush()

    quantity_diff = round(quantity_sold - previous_qty, 3)
    if quantity_diff != 0:
        await apply_stock_change(
            db,
            shop_id=shop_id,
            product_id=product_id,
            quantity_delta=-quantity_diff,
            transaction_type="sale",
            unit_price=float(product.selling_price or 0),
            reference_type="sales_entry",
            reference_id=sales_entry.id,
            notes=f"Sales entry update for {entry_date.isoformat()}",
        )

    return sales_entry, quantity_diff


async def add_sales_entry_without_stock_adjustment(
    db: AsyncSession,
    *,
    shop_id: int,
    product_id: int,
    entry_date: date,
    quantity_delta: float,
    revenue_delta: float,
    source: str,
) -> SalesEntry:
    await get_product_or_404(db, shop_id, product_id)
    existing_result = await db.execute(
        select(SalesEntry).where(
            SalesEntry.shop_id == shop_id,
            SalesEntry.product_id == product_id,
            SalesEntry.entry_date == entry_date,
        )
    )
    row = existing_result.scalar_one_or_none()

    if row:
        row.quantity_sold = round(float(row.quantity_sold or 0) + quantity_delta, 3)
        row.revenue = round(float(row.revenue or 0) + revenue_delta, 2)
        row.entry_source = source
        return row

    sales_entry = SalesEntry(
        shop_id=shop_id,
        product_id=product_id,
        entry_date=entry_date,
        quantity_sold=round(quantity_delta, 3),
        revenue=round(revenue_delta, 2),
        entry_source=source,
    )
    db.add(sales_entry)
    await db.flush()
    return sales_entry


def stock_status(stock_qty: float, minimum_required: float) -> str:
    if stock_qty <= 0 or stock_qty < minimum_required * 0.5:
        return "CRITICAL"
    if stock_qty < minimum_required:
        return "LOW_STOCK"
    return "IN_STOCK"


async def list_inventory_snapshot(db: AsyncSession, shop_id: int) -> list[dict]:
    latest_tx_subquery = (
        select(
            StockTransaction.product_id,
            func.max(StockTransaction.created_at).label("latest_created_at"),
        )
        .where(StockTransaction.shop_id == shop_id)
        .group_by(StockTransaction.product_id)
        .subquery()
    )

    sales_avg_subquery = (
        select(
            SalesEntry.product_id,
            (func.coalesce(func.sum(SalesEntry.quantity_sold), 0) / 7.0).label("avg_daily_qty"),
        )
        .where(
            SalesEntry.shop_id == shop_id,
            SalesEntry.entry_date >= date.today() - timedelta(days=6),
        )
        .group_by(SalesEntry.product_id)
        .subquery()
    )

    stmt: Select = (
        select(
            Product,
            func.coalesce(sales_avg_subquery.c.avg_daily_qty, 0).label("avg_daily_qty"),
            StockTransaction.created_at.label("latest_tx_at"),
            StockTransaction.transaction_type.label("latest_tx_type"),
        )
        .where(Product.shop_id == shop_id)
        .outerjoin(sales_avg_subquery, sales_avg_subquery.c.product_id == Product.id)
        .outerjoin(latest_tx_subquery, latest_tx_subquery.c.product_id == Product.id)
        .outerjoin(
            StockTransaction,
            and_(
                StockTransaction.product_id == Product.id,
                StockTransaction.created_at == latest_tx_subquery.c.latest_created_at,
            ),
        )
        .order_by(Product.name.asc())
    )

    result = await db.execute(stmt)
    rows = result.all()

    items: list[dict] = []
    for product, avg_daily_qty, latest_tx_at, latest_tx_type in rows:
        minimum_required = max(round(float(avg_daily_qty or 0) * 3, 1), 5.0)
        in_stock = round(float(product.stock_qty or 0), 3)
        items.append(
            {
                "id": product.id,
                "name": product.name,
                "category": product.category,
                "unit": product.unit,
                "selling_price": float(product.selling_price or 0),
                "cost_price": float(product.cost_price or 0) if product.cost_price is not None else None,
                "in_stock": in_stock,
                "stock_qty": in_stock,
                "minimum_required": minimum_required,
                "avg_daily_qty": round(float(avg_daily_qty or 0), 2),
                "status": stock_status(in_stock, minimum_required),
                "latest_update_at": latest_tx_at.isoformat() if latest_tx_at else None,
                "latest_update_type": latest_tx_type,
            }
        )

    return items


async def list_stock_transactions(
    db: AsyncSession,
    *,
    shop_id: int,
    product_id: int | None = None,
    transaction_type: str | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
    limit: int = 50,
) -> list[dict]:
    stmt = (
        select(StockTransaction, Product.name, Product.unit)
        .join(Product, Product.id == StockTransaction.product_id)
        .where(StockTransaction.shop_id == shop_id)
        .order_by(StockTransaction.created_at.desc())
        .limit(limit)
    )

    if product_id is not None:
        stmt = stmt.where(StockTransaction.product_id == product_id)
    if transaction_type:
        stmt = stmt.where(StockTransaction.transaction_type == transaction_type)
    if start_date is not None:
        stmt = stmt.where(func.date(StockTransaction.created_at) >= start_date.isoformat())
    if end_date is not None:
        stmt = stmt.where(func.date(StockTransaction.created_at) <= end_date.isoformat())

    result = await db.execute(stmt)
    rows = result.all()
    return [
        {
            "id": tx.id,
            "product_id": tx.product_id,
            "product_name": product_name,
            "unit": unit,
            "transaction_type": tx.transaction_type,
            "quantity_delta": float(tx.quantity_delta),
            "balance_after": float(tx.balance_after),
            "unit_price": float(tx.unit_price) if tx.unit_price is not None else None,
            "reference_type": tx.reference_type,
            "reference_id": tx.reference_id,
            "notes": tx.notes,
            "created_at": tx.created_at.isoformat() if tx.created_at else None,
        }
        for tx, product_name, unit in rows
    ]
