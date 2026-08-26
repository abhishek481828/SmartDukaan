"""Auth routes: register + login.

- POST /api/auth/register → creates user + shop + seeds benchmark data
- POST /api/auth/login    → verifies credentials, returns JWT

Ref: BACKEND_STRUCTURE.md Section 4 (first two endpoints)
"""
import re
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, field_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.database import get_db
from db.models import User, Shop
from core.auth_utils import hash_password, verify_password, create_access_token

router = APIRouter()

VALID_CATEGORIES = {"grains", "dairy", "fmcg", "vegetables", "spices", "beverages", "general"}
VALID_LANGUAGES = {"en", "hi", "te"}
PHONE_REGEX = re.compile(r"^[6-9]\d{9}$")


class RegisterRequest(BaseModel):
    phone: str
    name: str
    password: str
    city: str
    state: str
    language: str = "en"
    shop_name: str
    categories: list[str] = []
    cold_start_path: str = "benchmark"

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        if not PHONE_REGEX.match(v):
            raise ValueError("Must be 10 digits starting with 6-9")
        return v

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if len(v) < 6:
            raise ValueError("Password must be at least 6 characters")
        return v

    @field_validator("language")
    @classmethod
    def validate_language(cls, v: str) -> str:
        if v not in VALID_LANGUAGES:
            raise ValueError(f"Language must be one of {VALID_LANGUAGES}")
        return v

    @field_validator("categories")
    @classmethod
    def validate_categories(cls, v: list[str]) -> list[str]:
        for cat in v:
            if cat not in VALID_CATEGORIES:
                raise ValueError(f"Invalid category: {cat}. Must be one of {VALID_CATEGORIES}")
        return v

    @field_validator("cold_start_path")
    @classmethod
    def validate_cold_start_path(cls, v: str) -> str:
        if v not in {"benchmark", "csv", "ocr", "voice"}:
            raise ValueError("cold_start_path must be one of benchmark, csv, ocr, voice")
        return v


class LoginRequest(BaseModel):
    phone: str
    password: str


@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register(req: RegisterRequest, db: AsyncSession = Depends(get_db)):
    # Check phone uniqueness
    existing = await db.execute(select(User).where(User.phone == req.phone))
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"error": {"code": "CONFLICT", "message": "Phone number already registered"}},
        )

    # Create user
    user = User(
        phone=req.phone,
        name=req.name,
        password_hash=hash_password(req.password),
        city=req.city,
        state=req.state,
        language=req.language,
    )
    db.add(user)
    await db.flush()

    # Create shop
    shop = Shop(
        user_id=user.id,
        shop_name=req.shop_name,
        categories=req.categories,
        district=req.city,  # Use city as district for hackathon
        cold_start_path="manual",
    )
    db.add(shop)
    await db.flush()

    user.is_onboarded = True
    await db.commit()
    await db.refresh(user)
    await db.refresh(shop)

    # Generate JWT
    token = create_access_token(user.id, user.phone, shop.id, user.language)

    return {
        "access_token": token,
        "user": {"id": user.id, "name": user.name, "city": user.city},
        "shop": {"id": shop.id, "shop_name": shop.shop_name, "cold_start_path": shop.cold_start_path},
    }


@router.post("/login")
async def login(req: LoginRequest, db: AsyncSession = Depends(get_db)):
    # Find user by phone
    result = await db.execute(select(User).where(User.phone == req.phone))
    user = result.scalar_one_or_none()

    if not user or not verify_password(req.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"error": {"code": "UNAUTHORIZED", "message": "Invalid phone or password"}},
        )

    # Find associated shop
    result = await db.execute(select(Shop).where(Shop.user_id == user.id))
    shop = result.scalar_one_or_none()

    if not shop:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": {"code": "NOT_FOUND", "message": "No shop found for this user"}},
        )

    token = create_access_token(user.id, user.phone, shop.id, user.language)

    return {
        "access_token": token,
        "user": {"id": user.id, "name": user.name, "city": user.city},
        "shop": {"id": shop.id, "shop_name": shop.shop_name, "cold_start_path": shop.cold_start_path},
    }
