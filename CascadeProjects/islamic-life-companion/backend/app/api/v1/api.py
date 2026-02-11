from fastapi import APIRouter
from app.api.v1.endpoints import auth, habits, challenges, prayer_times, quran

api_router = APIRouter()

# Include endpoint routers
api_router.include_router(auth.router)
api_router.include_router(habits.router, prefix="/habits", tags=["habits"])
api_router.include_router(challenges.router, prefix="/challenges", tags=["challenges"])
api_router.include_router(prayer_times.router, prefix="/prayer-times", tags=["prayer-times"])
api_router.include_router(quran.router, prefix="/quran", tags=["quran"])
