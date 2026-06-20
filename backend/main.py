from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.database import SessionLocal, Base, engine
from app.api.v1.api import api_router
# Import all models for Alembic migrations
from app.models import user, prayer, habit, task, quran, calendar, dashboard, challenge

# Create tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Islamic Life Companion API",
    description="Backend API for Islamic Life Companion Application",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API router
app.include_router(api_router, prefix="/api/v1")

@app.get("/")
def read_root():
    return {"message": "Islamic Life Companion API is running"}

@app.get("/health")
def health_check():
    return {"status": "healthy"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
