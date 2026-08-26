"""SQLAlchemy async engine and session setup."""
import os
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./smartdukaan.db")

engine = create_async_engine(DATABASE_URL, echo=False)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def init_db():
    """Create all tables."""
    from db.models import Base as ModelBase  # noqa: F811
    async with engine.begin() as conn:
        await conn.run_sync(ModelBase.metadata.create_all)


async def get_db():
    """Dependency: yields an async session."""
    async with async_session() as session:
        yield session
