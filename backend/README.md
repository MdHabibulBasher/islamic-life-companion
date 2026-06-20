# Islamic Life Companion - Backend

FastAPI backend for the Islamic Life Companion application.

## Setup

### Prerequisites
- Python 3.10+
- PostgreSQL 14+

### Installation

1. Create a virtual environment:
```bash
python -m venv venv
venv\Scripts\activate  # Windows
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

3. Create `.env` file:
```bash
cp .env.example .env
```

4. Update `.env` with your database credentials and secret key

5. Create database:
```sql
CREATE DATABASE islamic_life_companion;
```

6. Initialize Alembic:
```bash
alembic init alembic
```

7. Run migrations:
```bash
alembic revision --autogenerate -m "Initial migration"
alembic upgrade head
```

### Running the Server

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

API will be available at: http://localhost:8000
API Documentation: http://localhost:8000/docs

## Project Structure

```
backend/
├── app/
│   ├── api/
│   │   └── v1/
│   │       ├── endpoints/
│   │       │   ├── auth.py
│   │       │   ├── prayers.py
│   │       │   ├── dashboard.py
│   │       │   └── ...
│   │       └── api.py
│   ├── core/
│   │   ├── config.py
│   │   ├── database.py
│   │   └── security.py
│   ├── models/
│   │   ├── user.py
│   │   ├── prayer.py
│   │   ├── habit.py
│   │   ├── task.py
│   │   ├── quran.py
│   │   ├── calendar.py
│   │   └── dashboard.py
│   ├── schemas/
│   │   ├── user.py
│   │   ├── prayer.py
│   │   └── ...
│   ├── crud/
│   └── services/
│       ├── prayer_times.py
│       └── hijri_converter.py
├── alembic/
├── main.py
├── requirements.txt
└── .env
```

## API Endpoints

### Authentication
- POST `/api/v1/auth/register` - Register new user
- POST `/api/v1/auth/login` - Login user
- POST `/api/v1/auth/refresh` - Refresh access token

### Prayers
- POST `/api/v1/prayers/tracking` - Create prayer tracking
- GET `/api/v1/prayers/tracking/{date}` - Get prayer tracking for date
- PUT `/api/v1/prayers/tracking/{date}` - Update prayer tracking
- GET `/api/v1/prayers/streaks` - Get prayer streaks
- GET `/api/v1/prayers/qada` - Get qada prayers
- PUT `/api/v1/prayers/qada` - Update qada prayers
- GET `/api/v1/prayers/times/{date}` - Get prayer times

### Dashboard
- GET `/api/v1/dashboard/summary` - Get dashboard summary
- GET `/api/v1/dashboard/weekly-progress` - Get weekly progress

## Database Models

Total: ~35 tables across 6 modules
- User & Auth: 2 tables
- Dashboard: 4 tables
- Calendar: 2 tables
- Prayer Tracker: 6 tables
- Habit Tracker: 9 tables
- To-Do List: 5 tables
- Quran Study: 8 tables
