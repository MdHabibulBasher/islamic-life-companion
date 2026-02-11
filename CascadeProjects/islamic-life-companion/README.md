# Islamic Life Companion

A comprehensive full-stack web application for tracking spiritual habits, viewing prayer times, reading Quran, and monitoring Islamic calendar events.

## Project Overview

**Islamic Life Companion** is designed to help Muslims manage their spiritual journey with features including:

- 📿 **Habit Tracking**: Create and track daily habits (prayer, Quran reading, etc.)
- 📊 **Statistics**: View detailed statistics and progress analytics
- 🕌 **Prayer Times**: Get accurate prayer times for your location
- 📖 **Quran Reading**: Track your Quran reading progress
- 📅 **Islamic Calendar**: Important Islamic dates and events
- 🏆 **Challenges**: Participate in spiritual challenges with friends
- 🎯 **Goals & Streaks**: Build consistent habits with streak tracking

## Technology Stack

### Backend
- **Framework**: FastAPI (Python 3.13)
- **Database**: PostgreSQL with SQLAlchemy ORM
- **Migration**: Alembic
- **Server**: Uvicorn (ASGI)
- **Authentication**: JWT tokens with access/refresh tokens
- **Password Security**: bcrypt hashing with passlib

### Frontend
- **Framework**: React 18.2.0 with TypeScript
- **Build Tool**: Vite 5.0.8
- **State Management**: Zustand + React Query
- **Styling**: Tailwind CSS 3.3.6 with dark mode
- **HTTP Client**: Axios (with interceptors for auth)
- **Routing**: React Router 6.20.0
- **Icons**: Lucide React

## Project Structure

```
islamic-life-companion/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   └── v1/
│   │   │       ├── endpoints/
│   │   │       │   ├── auth.py        # Authentication endpoints
│   │   │       │   ├── habits.py      # Habit CRUD & tracking
│   │   │       │   └── challenges.py  # Challenge endpoints
│   │   │       └── api.py             # API router aggregator
│   │   ├── models/                    # SQLAlchemy ORM models
│   │   ├── schemas/                   # Pydantic validation schemas
│   │   ├── services/                  # Business logic services
│   │   ├── core/
│   │   │   ├── config.py              # Environment settings
│   │   │   └── database.py            # DB connection & session
│   │   └── main.py                    # FastAPI app initialization
│   ├── alembic/                       # Database migrations
│   ├── requirements.txt               # Python dependencies
│   └── README.md
├── frontend/
│   ├── src/
│   │   ├── components/                # Reusable UI components
│   │   ├── pages/                     # Page components
│   │   ├── services/                  # API service layer
│   │   ├── hooks/                     # Custom React hooks
│   │   ├── store/                     # Zustand state stores
│   │   ├── types/                     # TypeScript interfaces
│   │   ├── utils/                     # Utility functions
│   │   ├── App.tsx                    # Main app component
│   │   └── main.tsx                   # Entry point
│   ├── package.json                   # npm dependencies
│   ├── tailwind.config.js             # Tailwind configuration
│   ├── vite.config.ts                 # Vite configuration
│   └── FRONTEND_SETUP.md
└── README.md (this file)
```

## Quick Start

### Prerequisites
- **Python 3.13+** for backend
- **Node.js 18+** for frontend
- **PostgreSQL 14+** (or SQLite for development)

### Backend Setup

1. **Navigate to backend directory:**
```bash
cd backend
```

2. **Create a virtual environment:**
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. **Install dependencies:**
```bash
pip install -r requirements.txt
```

4. **Create `.env` file:**
```
DATABASE_URL=postgresql://user:password@localhost:5432/islamic_life
SECRET_KEY=your-secret-key-here-change-in-production
ENV=development
API_V1_STR=/api/v1
ALADHAN_API_BASE_URL=https://api.aladhan.com/v1
```

5. **Run database migrations:**
```bash
alembic upgrade head
```

6. **Start the development server:**
```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

The backend API will be available at `http://localhost:8000`
- API documentation: `http://localhost:8000/docs`
- Alternative docs: `http://localhost:8000/redoc`

### Frontend Setup

1. **Navigate to frontend directory:**
```bash
cd frontend
```

2. **Install dependencies:**
```bash
npm install
```

3. **Create `.env` file:**
```
VITE_API_BASE_URL=http://localhost:8000/api/v1
```

4. **Start development server:**
```bash
npm run dev
```

The frontend will be available at `http://localhost:5173`

## API Endpoints

### Authentication
- `POST /api/v1/auth/login` - Login with email/password
- `POST /api/v1/auth/signup` - Create new account
- `POST /api/v1/auth/refresh` - Refresh access token
- `POST /api/v1/auth/logout` - Logout

### Habits
- `GET /api/v1/habits/categories` - Get habit categories
- `GET /api/v1/habits` - Get user's habits
- `POST /api/v1/habits` - Create new habit
- `PUT /api/v1/habits/{id}` - Update habit
- `DELETE /api/v1/habits/{id}` - Delete habit
- `POST /api/v1/habits/tracking` - Track habit completion
- `GET /api/v1/habits/statistics` - Get habit statistics
- `GET /api/v1/habits/summary/{date}` - Get daily summary

### Challenges
- `GET /api/v1/challenges` - Get all challenges
- `POST /api/v1/challenges` - Create challenge
- `POST /api/v1/challenges/{id}/join` - Join challenge
- `PUT /api/v1/challenges/{id}/tracking` - Update challenge progress

See full API documentation at `http://localhost:8000/docs` after starting the backend.

## Key Features

### 1. User Authentication
- Email/password registration and login
- JWT tokens with refresh token rotation
- Secure password hashing with bcrypt
- Session persistence with localStorage

### 2. Habit Tracking
- Create habits with categories and daily goals
- Track completion with timestamps
- Three view modes: Daily, Weekly, Monthly
- Habit statistics with completion rates
- Streak tracking

### 3. Dashboard
- Quick overview of today's completions
- Weekly progress visualization
- Achievement badges
- Total habits and streak information

### 4. Prayer Times
- Location-based prayer times
- Integration with Aladhan API
- Islamic calendar information
- Prayer time notifications

### 5. Challenges
- Create and join spiritual challenges
- Track group progress
- Challenge statistics
- Achievement rewards

## Development Tips

### Backend
- Use `uvicorn app.main:app --reload` for hot-reload during development
- FastAPI automatically generates API documentation at `/docs`
- Database changes require Alembic migrations:
  ```bash
  alembic revision --autogenerate -m "Description"
  alembic upgrade head
  ```

### Frontend
- Vite provides instant HMR (Hot Module Replacement)
- TypeScript provides compile-time type checking
- Use `npm run build` to create production bundle
- React Query DevTools helps debug data fetching

### Testing
Check individual README files for testing instructions:
- [Frontend Testing](frontend/FRONTEND_SETUP.md)
- [Backend Testing](backend/README.md)

## Database Schema

### Users Table
```sql
id (INT, PRIMARY KEY)
email (VARCHAR, UNIQUE)
full_name (VARCHAR)
password_hash (VARCHAR)
is_active (BOOLEAN)
created_at (DATETIME)
updated_at (DATETIME)
last_login (DATETIME)
```

### Habits Table
```sql
id (INT, PRIMARY KEY)
user_id (INT, FOREIGN KEY)
name (VARCHAR)
category (VARCHAR)
description (TEXT)
goal_count (INT)
frequency (VARCHAR)
is_active (BOOLEAN)
created_at (DATETIME)
updated_at (DATETIME)
```

### Habit Tracking Table
```sql
id (INT, PRIMARY KEY)
habit_id (INT, FOREIGN KEY)
user_id (INT, FOREIGN KEY)
tracked_date (DATE)
count (INT)
notes (TEXT)
tracking_type (VARCHAR)
completed_at (DATETIME)
```

## Deployment

### Backend Deployment (Production)
1. Set environment variables properly
2. Use PostgreSQL instead of SQLite
3. Set `SECRET_KEY` to a secure random string
4. Use a production ASGI server:
   ```bash
   gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker
   ```

### Frontend Deployment (Production)
1. Build the frontend:
   ```bash
   npm run build
   ```
2. Deploy the `dist/` folder to a static hosting service (Netlify, Vercel, etc.)
3. Configure API base URL for production environment

## Environment Variables

### Backend (.env)
```
DATABASE_URL=postgresql://user:password@host:5432/db_name
SECRET_KEY=your-secret-key-change-in-production
ENV=production
API_V1_STR=/api/v1
ALADHAN_API_BASE_URL=https://api.aladhan.com/v1
SEED_ADMIN_EMAIL=admin@example.com
SEED_ADMIN_PASSWORD=securepassword
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=30
```

### Frontend (.env)
```
VITE_API_BASE_URL=http://localhost:8000/api/v1
```

## Troubleshooting

### Backend
- **Database connection error**: Verify PostgreSQL is running and `DATABASE_URL` is correct
- **Port 8000 in use**: Use `lsof -i :8000` to find the process, then `kill -9 <PID>`
- **Migration errors**: Check migration scripts in `alembic/versions/`

### Frontend
- **Tailwind CSS not showing**: Run `npm install` and `npm run dev` again
- **API calls failing**: Check `VITE_API_BASE_URL` in `.env` and ensure backend is running
- **Port 5173 in use**: Vite will automatically use the next available port

## Contributing

Guidelines for contributing to this project:
1. Create a feature branch: `git checkout -b feature/your-feature`
2. Follow existing code style and structure
3. Write clear commit messages
4. Test your changes locally
5. Submit a pull request

## License

This project is open source and available under the MIT License.

## Support

For issues, questions, or feature requests, please open an issue on the GitHub repository.

---

**Built with ❤️ for the Muslim community**
