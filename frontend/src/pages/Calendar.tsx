import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

export const Calendar = () => {
  const [currentDate, setCurrentDate] = useState(new Date(2026, 1, 11))

  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
  }

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay()
  }

  const previousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1))
  }

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1))
  }

  const daysInMonth = getDaysInMonth(currentDate)
  const firstDay = getFirstDayOfMonth(currentDate)
  const days = []

  // Empty cells for days before month starts
  for (let i = 0; i < firstDay; i++) {
    days.push(<div key={`empty-${i}`} className="p-2"></div>)
  }

  // Days of month
  for (let day = 1; day <= daysInMonth; day++) {
    const isToday =
      day === new Date().getDate() &&
      currentDate.getMonth() === new Date().getMonth() &&
      currentDate.getFullYear() === new Date().getFullYear()

    days.push(
      <div
        key={day}
        className={`p-4 text-center rounded-lg ${
          isToday ? 'bg-green-600 text-white font-bold' : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-green-100 dark:hover:bg-green-900'
        }`}
      >
        {day}
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 md:pt-0">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">Calendar</h1>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        {/* Month Navigation */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={previousMonth}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
          >
            <ChevronLeft size={24} className="text-gray-900 dark:text-white" />
          </button>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </h2>
          <button
            onClick={nextMonth}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
          >
            <ChevronRight size={24} className="text-gray-900 dark:text-white" />
          </button>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 gap-2 mb-4">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
            <div key={day} className="text-center font-semibold text-gray-600 dark:text-gray-400 p-2">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-2">{days}</div>

        {/* Upcoming Events */}
        <div className="mt-8 pt-8 border-t border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Upcoming Events</h3>
          <div className="space-y-3">
            <div className="flex items-center gap-4 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border-l-4 border-green-600">
              <div className="w-3 h-3 bg-green-600 rounded-full"></div>
              <div>
                <p className="font-semibold text-gray-900 dark:text-white">Fajr Prayer</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">Today at 5:30 AM</p>
              </div>
            </div>
            <div className="flex items-center gap-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border-l-4 border-blue-600">
              <div className="w-3 h-3 bg-blue-600 rounded-full"></div>
              <div>
                <p className="font-semibold text-gray-900 dark:text-white">Daily Habit Reminder</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">Today at 7:00 AM</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
