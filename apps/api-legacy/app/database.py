from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.config import settings

# Supabase-compatible connection settings:
# - pool_pre_ping: detect stale connections
# - pool_recycle: recycle connections every 5 minutes (Supabase transaction pooler)
# - prepare_threshold=0: required for Supabase pgbouncer compatibility
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=False,
    pool_size=20,
    max_overflow=10,
    pool_pre_ping=True,
    pool_recycle=300,
    connect_args={"prepared_statement_cache_size": 0} if "supabase" in settings.DATABASE_URL.lower() else {},
)

async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db():
    async with async_session() as session:
        try:
            yield session
        finally:
            await session.close()