# Import all models so Alembic and SQLAlchemy can discover them via Base.metadata.
# Order doesn't matter for SQLAlchemy metadata, but keep it grouped for readability.

from app.models.user import User, UserPreferences, UserLocationSetting  # noqa: F401
from app.models.habit import (  # noqa: F401
    HabitCategory,
    UserHabit,
    HabitTracking,
    HabitStreak,
    DailyHabitSummary,
    HabitAchievement,
    UserAchievement,
    HabitStatistics,
    WeeklyPlan,
)
from app.models.challenge import (  # noqa: F401
    Challenge,
    UserChallengeProgress,
    ChallengeCompletion,
)
from app.models.prayer import (  # noqa: F401
    Prayer,
    PrayerTracking,
    PrayerStreak,
    PrayerQada,
    PrayerSettings,
    PrayerStatistics,
    PrayerName,
    CalculationMethod,
    JuristicMethod,
    JamaahStatus,
)
from app.models.quran import Quran  # noqa: F401
from app.models.calendar import IslamicEvent, LocationSettings  # noqa: F401
from app.models.task import Task  # noqa: F401
from app.models.notification import Notification  # noqa: F401
from app.models.dashboard import Dashboard  # noqa: F401
from app.models.fasting import FastingEntry  # noqa: F401