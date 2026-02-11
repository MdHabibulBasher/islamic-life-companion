# ⚡ Quick Reference Guide

## 🚀 Start the Project (3 Simple Steps)

### Step 1: Start Backend (Terminal 1)
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
echo "DATABASE_URL=sqlite:///./islamic_life_companion.db
SECRET_KEY=dev-key-change-in-production
ENV=development" > .env
uvicorn app.main:app --reload --port 8000
```
✅ Backend ready at http://localhost:8000

### Step 2: Start Frontend (Terminal 2)
```bash
cd frontend
npm install
echo "VITE_API_BASE_URL=http://localhost:8000/api/v1" > .env
npm run dev
```
✅ Frontend ready at http://localhost:5173

### Step 3: Open in Browser
- Go to http://localhost:5173
- Click "Sign Up" 
- Create account with email and password
- Start tracking habits!

---

## 📚 Key URLs

| Service | URL | Purpose |
|---------|-----|---------|
| Frontend App | http://localhost:5173 | Main application |
| Backend API | http://localhost:8000 | API endpoints |
| API Docs | http://localhost:8000/docs | Interactive API testing |
| Alternative Docs | http://localhost:8000/redoc | API documentation |

---

## 🔑 Important Commands

### Backend
```bash
# Start development server
uvicorn app.main:app --reload --port 8000

# Run database migrations
alembic upgrade head

# Create new migration
alembic revision --autogenerate -m "Description"

# Check API docs
open http://localhost:8000/docs
```

### Frontend
```bash
# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Run linter
npm run lint
```

---

## 📋 API Examples

### Register User
```bash
curl -X POST "http://localhost:8000/api/v1/auth/signup" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "Password123!",
    "full_name": "John Doe"
  }'
```

### Login User
```bash
curl -X POST "http://localhost:8000/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "Password123!"
  }'
```

### Create Habit (replace TOKEN with access_token from login)
```bash
curl -X POST "http://localhost:8000/api/v1/habits" \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Morning Prayer",
    "category": "Prayer",
    "goal_count": 1,
    "frequency": "daily"
  }'
```

---

## 🆘 Troubleshooting

| Problem | Solution |
|---------|----------|
| Port 8000 in use | `lsof -i :8000` then `kill -9 <PID>` |
| Port 5173 in use | Port auto-increments, check terminal |
| npm not found | Install Node.js from nodejs.org |
| ModuleNotFoundError | Run `pip install -r requirements.txt` in venv |
| Tailwind not working | Run `npm install` and `npm run dev` again |
| API 401 error | Login expired, sign out and login again |

---

## 🎬 Feature Walkthrough

### 1. Signup & Login
1. Visit http://localhost:5173
2. Click "Sign Up"
3. Enter email and password
4. Submit to create account
5. Login with credentials

### 2. Create Habit
1. On HabitTracker page, click "+ Add Habit"
2. Fill in name, category, goal
3. Click "Add Habit"
4. Habit appears in your list

### 3. Track Habit
1. Click the ✓ button on a habit
2. Use counter or timer
3. Click "Mark Complete"
4. Habit marked for today

### 4. View Stats
1. See daily completion in header
2. View statistics card
3. Check weekly/monthly views

---

## 📁 File Structure Reference

### Most Important Files

**Backend**:
- `backend/app/main.py` - FastAPI app initialization
- `backend/app/api/v1/api.py` - API router aggregator
- `backend/app/models/` - Database models
- `backend/app/schemas/` - Request/response validation
- `backend/app/core/config.py` - Environment settings
- `backend/requirements.txt` - Python dependencies

**Frontend**:
- `frontend/src/App.tsx` - Main app component
- `frontend/src/pages/` - Page components
- `frontend/src/components/` - Reusable components
- `frontend/src/services/api.ts` - API client
- `frontend/src/store/authStore.ts` - Auth state
- `frontend/package.json` - npm dependencies

---

## 🔒 Security Notes

⚠️ **Development Only**:
- Current `SECRET_KEY` is for development
- Change `SECRET_KEY` in production to secure random value
- Don't commit `.env` file to git
- Use environment variables for all secrets

✅ **Best Practices**:
- Always validate user input
- Use HTTPS in production
- Implement rate limiting
- Use secure cookies for tokens
- Keep dependencies updated

---

## 📞 Getting Help

1. **Check API Docs**: http://localhost:8000/docs
2. **Read Logs**: Watch terminal output for errors
3. **Browser Console**: F12 → Console tab for frontend errors
4. **See README.md**: Detailed documentation
5. **See GETTING_STARTED.md**: Comprehensive setup guide

---

## ⚙️ Environment Variables Quick Reference

### Backend `.env`
```
DATABASE_URL=sqlite:///./islamic_life_companion.db
SECRET_KEY=dev-key-change-in-production
ENV=development
```

### Frontend `.env`
```
VITE_API_BASE_URL=http://localhost:8000/api/v1
```

---

## 🎯 Common Tasks

| Task | Command |
|------|---------|
| Check if backend running | `curl http://localhost:8000/docs` |
| See API documentation | Open http://localhost:8000/docs |
| Create test data | Sign up and create habits in UI |
| View database (SQLite) | `sqlite3 islamic_life_companion.db` |
| Reset database | Delete `.db` file and restart |
| Clear npm cache | `npm cache clean --force` |
| Rebuild dependencies | `rm -rf node_modules && npm install` |

---

## 📊 Technology Stack Reminder

- **Backend**: FastAPI, SQLAlchemy, PostgreSQL/SQLite
- **Frontend**: React, TypeScript, Tailwind CSS, Vite
- **Authentication**: JWT tokens with bcrypt hashing
- **HTTP**: Axios with interceptors
- **State**: Zustand + React Query
- **Icons**: Lucide React
- **Database**: Alembic migrations

---

## ✅ Pre-Launch Checklist

- [ ] Backend running on port 8000
- [ ] Frontend running on port 5173
- [ ] Create test account successfully
- [ ] Can login/logout
- [ ] Can create habit
- [ ] Can track habit
- [ ] Can view statistics
- [ ] No errors in console

---

**You're all set! Start building your Islamic life companion app! 🕌**

For detailed documentation, see:
- [README.md](../README.md) - Full project documentation
- [GETTING_STARTED.md](../GETTING_STARTED.md) - Step-by-step setup
- [PROGRESS.md](../PROGRESS.md) - Project progress tracking
