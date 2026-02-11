from app.core.database import SessionLocal
from app.models.habit import HabitTracking
from datetime import date

db = SessionLocal()
records = db.query(HabitTracking).filter(
    HabitTracking.tracking_date == date.today()
).all()

print(f'Found {len(records)} tracking records for today:')
for r in records:
    print(f'  Habit {r.habit_id}: is_completed={r.is_completed}')

db.close()
