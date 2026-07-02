"""Database engine and session factory.

PostgreSQL-only. DATABASE_URL is expected to look like:
    postgresql+psycopg://USER:PASSWORD@HOST:5432/DBNAME
"""
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

from app.core.config import settings

engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,  # detect dropped connections in long-running workers
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()