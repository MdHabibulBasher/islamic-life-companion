# 🕌 Islamic Life Companion - Getting Started Guide

## Overview
This is a complete full-stack application for tracking spiritual habits, prayer times, and Islamic calendar events. The setup requires both backend and frontend to run simultaneously.

## System Requirements
- **Python 3.13+** (for backend)
- **Node.js 18+** (for frontend)
- **PostgreSQL 14+** or you can use SQLite for development
- **npm or yarn** (Node package manager)
- **Git** (for version control)

## Installation & Setup

### Option 1: Quick Start (Development Setup)

#### Terminal 1 - Backend Setup
```bash
# Navigate to backend directory
cd backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Create .env file in backend directory
cat > .env << EOF
DATABASE_URL=sqlite:///./islamic_life_companion.db
SECRET_KEY=your-secret-key-here-change-in-production
ENV=development
API_V1_STR=/api/v1
ALADHAN_API_BASE_URL=https://api.aladhan.com/v1
SEED_ADMIN_EMAIL=admin@example.com
SEED_ADMIN_PASSWORD=Admin123!
EOF

# Run migrations (if using PostgreSQL, ensure database exists first)
alembic upgrade head

# Start backend server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**Expected Output:**
```
INFO:     Uvicorn running on http://0.0.0.0:8000
INFO:     Application startup complete
```

#### Terminal 2 - Frontend Setup
```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Create .env file in frontend directory
echo "VITE_API_BASE_URL=http://localhost:8000/api/v1" > .env

# Start frontend development server
npm run dev
```

**Expected Output:**
```
  VITE v5.0.8  ready in 283 ms

  ➜  Local:   http://localhost:5173/
  ➜  press h to show help
```

### Option 2: PostgreSQL Setup (Recommended for Production)

1. **Install PostgreSQL** from https://www.postgresql.org/download/
2. **Create database:**
```sql
CREATE DATABASE islamic_life_companion;
CREATE USER ilc_user WITH PASSWORD 'secure_password';
ALTER ROLE ilc_user SET client_encoding TO 'utf8';
ALTER ROLE ilc_user SET default_transaction_isolation TO 'read committed';
ALTER ROLE ilc_user SET default_transaction_deferrable TO on;
ALTER ROLE ilc_user SET default_transaction_read_write TO on;
ALTER ROLE ilc_user SET timezone TO 'UTC';
GRANT ALL PRIVILEGES ON DATABASE islamic_life_companion TO ilc_user;
```

3. **Update `.env` in backend:**
```
DATABASE_URL=postgresql://ilc_user:secure_password@localhost:5432/islamic_life_companion
```

4. **Run migrations:**
```bash
cd backend
alembic upgrade head
```

## Accessing the Application

### Frontend
- **URL**: http://localhost:5173
- **Default Actions**:
  - Click "Sign Up" to create a new account
  - Use your email and password
  - Password must be: 8+ chars, 1 uppercase, 1 number, 1 special char
  - After login, you'll see the HabitTracker page

### Backend API
- **Documentation**: http://localhost:8000/docs (Swagger UI)
- **Alternative Docs**: http://localhost:8000/redoc (ReDoc)
- **OpenAPI JSON**: http://localhost:8000/openapi.json

## Testing the API

### 1. Create User Account
```bash
curl -X POST "http://localhost:8000/api/v1/auth/signup" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "Password123!",
    "full_name": "John Doe"
  }'
```

### 2. Login
```bash
curl -X POST "http://localhost:8000/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "Password123!"
  }'
```

**Response:**
```json
{
  "access_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "refresh_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "full_name": "John Doe",
    "is_active": true,
    "created_at": "2024-01-20T10:30:00",
    "last_login": "2024-01-20T10:31:00"
  },
  "token_type": "bearer"
}
```

### 3. Create Habit (with authentication)
```bash
curl -X POST "http://localhost:8000/api/v1/habits" \
  -H "Authorization: Bearer ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Morning Prayer",
    "category": "Prayer",
    "description": "Read Fajr prayer",
    "goal_count": 1,
    "frequency": "daily"
  }'
```

Replace `ACCESS_TOKEN` with the token from login response.

## File Structure After Setup

```
islamic-life-companion/
├── backend/
│   ├── venv/                    # Virtual environment
│   ├── app/                     # Main application
│   ├── alembic/                 # Database migrations
│   ├── .env                     # Environment variables (created)
│   ├── requirements.txt         # Dependencies
│   └── main.py                  # Entry point
├── frontend/
│   ├── node_modules/            # Dependencies (created)
│   ├── dist/                    # Build output (created on npm run build)
│   ├── src/                     # Source code
│   ├── .env                     # Environment variables (created)
│   ├── package.json             # npm configuration
│   └── vite.config.ts           # Vite configuration
└── README.md
```

## Environment Variables

### Backend (.env)
| Variable | Default | Description |
|----------|---------|-------------|
| DATABASE_URL | sqlite:///./islamic_life_companion.db | Database connection string |
| SECRET_KEY | your-secret-key-here | JWT secret key (change in production!) |
| ENV | development | Environment: development, staging, production |
| API_V1_STR | /api/v1 | API prefix path |
| ALADHAN_API_BASE_URL | https://api.aladhan.com/v1 | Prayer times API |
| ACCESS_TOKEN_EXPIRE_MINUTES | 30 | JWT access token lifetime |
| REFRESH_TOKEN_EXPIRE_DAYS | 30 | Refresh token lifetime |

### Frontend (.env)
| Variable | Default | Description |
|----------|---------|-------------|
| VITE_API_BASE_URL | http://localhost:8000/api/v1 | Backend API endpoint |

## Common Issues & Troubleshooting

### Backend Issues

**Issue: "Address already in use" on port 8000**
```bash
# Find process using port 8000
lsof -i :8000  # or netstat -an on Windows

# Kill the process
kill -9 <PID>  # or use Task Manager on Windows
```

**Issue: "ModuleNotFoundError: No module named..."**
```bash
# Ensure virtual environment is activated
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Reinstall dependencies
pip install -r requirements.txt
```

**Issue: "database connection failed"**
```bash
# Check DATABASE_URL in .env is correct
# For PostgreSQL: postgresql://user:password@localhost:5432/dbname
# For SQLite: sqlite:///./islamic_life_companion.db

# Test PostgreSQL connection
psql postgresql://user:password@localhost:5432/dbname
```

### Frontend Issues

**Issue: "npm: command not found"**
```bash
# Install Node.js from https://nodejs.org/
# Then try npm install again
```

**Issue: "Tailwind CSS not showing"**
```bash
# Run these commands
npm install
npm run dev

# Clear browser cache (Ctrl+Shift+Delete) and reload
```

**Issue: "API calls return 401 (Unauthorized)"**
- Check that backend is running on http://localhost:8000
- Token might have expired, try logging out and back in
- Check browser console for detailed error messages

**Issue: "Cannot find module" in frontend**
```bash
# Clean install dependencies
rm -rf node_modules
npm install
npm run dev
```

## Development Workflow

### Making Backend Changes
1. Edit Python files in `backend/app/`
2. FastAPI with `--reload` automatically reloads the server
3. Test at http://localhost:8000/docs

### Making Frontend Changes
1. Edit TypeScript/React files in `frontend/src/`
2. Vite automatically updates in the browser (HMR)
3. View results at http://localhost:5173

### Database Schema Changes
1. Create migration: `alembic revision --autogenerate -m "Description"`
2. Review the generated file in `alembic/versions/`
3. Run: `alembic upgrade head`

## Next Steps After Setup

1. ✅ Create a test account by signing up
2. ✅ Create a habit using the "+ Add Habit" button
3. ✅ Track the habit by clicking on the button
4. ✅ View statistics on the dashboard
5. ✅ Explore other pages (Prayer Times, Dashboard, etc.)

## Production Deployment

### Backend
```bash
# Install gunicorn
pip install gunicorn

# Run production server
gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000
```

### Frontend
```bash
# Build optimized bundle
npm run build

# Deploy dist/ folder to hosting (Vercel, Netlify, etc.)
```

## Getting Help

- **Backend Docs**: http://localhost:8000/docs (when running)
- **Frontend Issues**: Check console in browser (F12)
- **Database Issues**: Check PostgreSQL logs
- **API Errors**: Check detailed error messages in responses

## Performance Tips

1. **Backend**: Use PostgreSQL in production (faster than SQLite)
2. **Docker**: Containerize both services for consistent deployment
3. **Caching**: React Query automatically caches API responses
4. **Optimization**: Run `npm run build` and serve static files with CDN

---

**🎉 You're all set! Start building your Islamic life companion journey!**

For detailed feature documentation, see [README.md](../README.md)
