"""JWT auth utilities: create token, verify token, dependency."""
import os
from datetime import datetime, timedelta, timezone

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
import bcrypt

JWT_SECRET = os.getenv("JWT_SECRET", "dev-secret-change-me")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
JWT_EXPIRY_DAYS = int(os.getenv("JWT_EXPIRY_DAYS", "7"))

security = HTTPBearer()


def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


def create_access_token(user_id: int, phone: str, shop_id: int, language: str = "en") -> str:
    payload = {
        "sub": str(user_id),
        "phone": phone,
        "shop_id": shop_id,
        "language": language,
        "iat": datetime.now(timezone.utc),
        "exp": datetime.now(timezone.utc) + timedelta(days=JWT_EXPIRY_DAYS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"error": {"code": "UNAUTHORIZED", "message": "Invalid or expired token"}},
        )


class TokenData:
    """Decoded JWT payload injected into route handlers."""
    def __init__(self, user_id: int, phone: str, shop_id: int, language: str):
        self.user_id = user_id
        self.phone = phone
        self.shop_id = shop_id
        self.language = language


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> TokenData:
    """FastAPI dependency: extracts and validates JWT from Authorization header."""
    payload = decode_token(credentials.credentials)
    return TokenData(
        user_id=int(payload["sub"]),
        phone=payload["phone"],
        shop_id=payload["shop_id"],
        language=payload.get("language", "en"),
    )
