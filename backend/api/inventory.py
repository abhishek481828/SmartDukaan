"""Inventory routes backed by real product and stock transaction data."""
from datetime import date

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, field_validator
from sqlalchemy.ext.asyncio import AsyncSession

from core.auth_utils import TokenData, get_current_user
from db.database import get_db
from db.models import Product
from services.inventory import apply_stock_change, list_inventory_snapshot, list_stock_transactions

router = APIRouter()


class InventoryAdjustmentRequest(BaseModel):
    product_id: int
    quantity_delta: float
    transaction_type: str = "manual_adjustment"
    unit_price: float | None = None
    notes: str | None = None

    @field_validator("transaction_type")
    @classmethod
    def validate_type(cls, value: str) -> str:
        allowed = {"restock", "manual_adjustment", "sale"}
        if value not in allowed:
            raise ValueError(f"transaction_type must be one of {sorted(allowed)}")
        return value

    @field_validator("quantity_delta")
    @classmethod
    def validate_delta(cls, value: float) -> float:
        if value == 0:
            raise ValueError("quantity_delta must not be zero")
        return value


class CreateProductRequest(BaseModel):
    name: str
    category: str
    unit: str = "kg"
    selling_price: float
    cost_price: float | None = None
    stock_qty: float = 0

    @field_validator("name", "category", "unit")
    @classmethod
    def validate_text(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Field is required")
        return value

    @field_validator("selling_price", "stock_qty")
    @classmethod
    def validate_positive(cls, value: float) -> float:
        if value < 0:
            raise ValueError("Value must be non-negative")
        return value


@router.get("")
async def get_inventory(
    current_user: TokenData = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await list_inventory_snapshot(db, current_user.shop_id)


@router.post("/products", status_code=201)
async def create_inventory_product(
    req: CreateProductRequest,
    current_user: TokenData = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    product = Product(
        shop_id=current_user.shop_id,
        name=req.name,
        category=req.category,
        unit=req.unit,
        selling_price=req.selling_price,
        cost_price=req.cost_price,
        stock_qty=0,
    )
    db.add(product)
    await db.flush()

    if req.stock_qty:
        await apply_stock_change(
            db,
            shop_id=current_user.shop_id,
            product_id=product.id,
            quantity_delta=req.stock_qty,
            transaction_type="restock",
            unit_price=req.cost_price,
            reference_type="product_create",
            reference_id=product.id,
            notes="Initial stock on product creation",
        )

    await db.commit()
    await db.refresh(product)

    return {
        "id": product.id,
        "name": product.name,
        "category": product.category,
        "unit": product.unit,
        "selling_price": float(product.selling_price),
        "cost_price": float(product.cost_price) if product.cost_price is not None else None,
        "stock_qty": float(product.stock_qty or 0),
    }


@router.get("/transactions")
async def get_inventory_transactions(
    product_id: int | None = Query(default=None),
    transaction_type: str | None = Query(default=None),
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    current_user: TokenData = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await list_stock_transactions(
        db,
        shop_id=current_user.shop_id,
        product_id=product_id,
        transaction_type=transaction_type,
        start_date=start_date,
        end_date=end_date,
        limit=limit,
    )


@router.post("/adjust", status_code=201)
async def adjust_inventory(
    req: InventoryAdjustmentRequest,
    current_user: TokenData = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    transaction = await apply_stock_change(
        db,
        shop_id=current_user.shop_id,
        product_id=req.product_id,
        quantity_delta=req.quantity_delta,
        transaction_type=req.transaction_type,  # type: ignore[arg-type]
        unit_price=req.unit_price,
        reference_type="inventory_adjustment",
        notes=req.notes,
    )
    await db.commit()

    return {
        "transaction_id": transaction.id,
        "product_id": transaction.product_id,
        "quantity_delta": float(transaction.quantity_delta),
        "balance_after": float(transaction.balance_after),
        "transaction_type": transaction.transaction_type,
    }
