# Frontend Setup & Running

## Prerequisites
- Node.js 18+ 
- npm or yarn

## Installation

```bash
cd frontend
npm install
```

This installs all dependencies including:
- React 18.2.0
- React Router 6.20.0
- TypeScript 5.2.2
- Vite 5.0.8
- Tailwind CSS 3.3.6
- Lucide React icons
- Zustand for state management
- Tanstack React Query for data fetching
- Axios for HTTP requests

## Running the Development Server

```bash
npm run dev
```

The frontend will be available at **http://localhost:5173**

## Building for Production

```bash
npm run build
```

This builds the project with Vite and generates optimized assets in the `dist/` folder.

## Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── Modal.tsx       # Modal and ConfirmModal components
│   ├── Toast.tsx       # Toast notifications and useToast hook
│   ├── Loading.tsx     # LoadingSpinner and Skeleton loaders
│   ├── Form.tsx        # Input, TextArea, Select, Button form components
│   ├── Navigation.tsx  # Top navigation bar
│   ├── HabitCounter.tsx
│   ├── HabitTimer.tsx
│   ├── ChallengeStatistics.tsx
│   └── ChallengesSection.tsx
├── pages/               # Page components
│   ├── HabitTracker.tsx     # Main habit tracking page
│   ├── Dashboard.tsx        # Dashboard overview
│   ├── PrayerTimes.tsx      # Prayer times display
│   └── auth/
│       ├── Login.tsx        # Login page
│       └── Signup.tsx       # Signup page
├── services/            # API services
│   ├── api.ts           # Axios client with auth interceptors
│   ├── habitService.ts  # Habit API calls
│   ├── challengeService.ts
│   └── notificationService.ts
├── hooks/               # Custom React hooks
│   ├── index.ts         # useAuth, useForm, useAsync
├── store/               # State management (Zustand)
│   └── authStore.ts     # Authentication state
├── types/               # TypeScript type definitions
│   └── index.ts
├── utils/               # Utility functions
│   └── index.ts
├── App.tsx              # Main app component with routing
├── main.tsx             # Entry point
└── index.css            # Global styles with Tailwind

```

## Key Features Implemented

✅ **Authentication**
- Login and Signup pages with form validation
- JWT token management with Axios interceptors
- Protected routes

✅ **Habit Tracking**
- Daily habit tracking with multiple views (daily/weekly/monthly)
- Habit statistics and progress visualization
- Create, update, delete habits

✅ **UI Components**
- Modal dialogs
- Toast notifications
- Loading spinners
- Form inputs with validation
- Responsive navigation

✅ **Styling**
- Tailwind CSS with dark mode support
- Responsive design for mobile/tablet/desktop
- Smooth animations and transitions

✅ **State Management**
- Zustand for auth state with localStorage persistence
- React Query for server state caching

## Environment Variables

Create a `.env` file in the frontend directory:

```
VITE_API_BASE_URL=http://localhost:8000/api/v1
```

## Troubleshooting

### Tailwind CSS not working
Make sure to rebuild after `npm install`:
```bash
npm run dev
```

### API calls failing
- Check that backend is running on `http://localhost:8000`
- Check `VITE_API_BASE_URL` in `.env`
- Check browser console for CORS errors

### Port 5173 already in use
Vite will automatically use the next available port. Check the terminal output.

## Development Tips

- Use `npm run lint` to check code quality
- Hot Module Replacement (HMR) is enabled by default
- Check browser DevTools console for errors
- Use React Query DevTools for debugging queries

## Next Steps

1. Start the backend: `cd backend && uvicorn app.main:app --reload`
2. Start the frontend: `cd frontend && npm run dev`
3. Open http://localhost:5173 and login
4. Start tracking habits!
