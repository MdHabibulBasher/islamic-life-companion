from fastapi import APIRouter

from app.api.v1.endpoints import (
    auth,
    challenges,
    dashboard,
    fasting,
    habits,
    islamic_calendar,
    notifications,
    prayer_times,
    prayer_tracking,
    quran,
    tasks,
    user,
)

api_router = APIRouter()

# Include endpoint routers
api_router.include_router(auth.router)
api_router.include_router(user.router)
api_router.include_router(habits.router, prefix="/habits", tags=["habits"])
api_router.include_router(challenges.router, prefix="/challenges", tags=["challenges"])
api_router.include_router(
    prayer_times.router, prefix="/prayer-times", tags=["prayer-times"]
)
api_router.include_router(
    prayer_tracking.router, prefix="/prayer-tracking", tags=["prayer-tracking"]
)
api_router.include_router(quran.router, prefix="/quran", tags=["quran"])
api_router.include_router(tasks.router)
api_router.include_router(
    islamic_calendar.router, tags=["islamic-calendar"]
)
api_router.include_router(notifications.router)
api_router.include_router(dashboard.router)
api_router.include_router(fasting.router, prefix="/fasting", tags=["fasting"])