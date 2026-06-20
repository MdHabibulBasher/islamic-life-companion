import React, { useState } from 'react';
import { BarChart3, TrendingUp, Calendar, Award, Zap, Target } from 'lucide-react';
import { Button } from '../components/Form';

interface StatisticCard {
  title: string;
  value: string | number;
  change: number;
  icon: React.ReactNode;
  trend: 'up' | 'down' | 'neutral';
}

export const Analytics: React.FC = () => {
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'year'>('month');

  const statistics: StatisticCard[] = [
    {
      title: 'Total Habits Completed',
      value: '127',
      change: 12,
      icon: <Target className="w-6 h-6" />,
      trend: 'up',
    },
    {
      title: 'Current Streak',
      value: '21 days',
      change: 5,
      icon: <Zap className="w-6 h-6" />,
      trend: 'up',
    },
    {
      title: 'Completion Rate',
      value: '87%',
      change: 3,
      icon: <TrendingUp className="w-6 h-6" />,
      trend: 'up',
    },
    {
      title: 'Achievements Earned',
      value: '8',
      change: 2,
      icon: <Award className="w-6 h-6" />,
      trend: 'up',
    },
  ];

  const habitStats = [
    { name: 'Morning Prayer', completed: 28, total: 30, percentage: 93 },
    { name: 'Quran Reading', completed: 25, total: 30, percentage: 83 },
    { name: 'Exercise', completed: 22, total: 30, percentage: 73 },
    { name: 'Meditation', completed: 26, total: 30, percentage: 87 },
    { name: 'Water Intake', completed: 29, total: 30, percentage: 97 },
  ];

  const weeklyData = [
    { day: 'Mon', completed: 5, total: 6 },
    { day: 'Tue', completed: 5, total: 6 },
    { day: 'Wed', completed: 4, total: 6 },
    { day: 'Thu', completed: 6, total: 6 },
    { day: 'Fri', completed: 6, total: 6 },
    { day: 'Sat', completed: 5, total: 6 },
    { day: 'Sun', completed: 6, total: 6 },
  ];

  const monthlyData = [
    { week: 'Week 1', completed: 34, total: 42 },
    { week: 'Week 2', completed: 38, total: 42 },
    { week: 'Week 3', completed: 35, total: 42 },
    { week: 'Week 4', completed: 40, total: 42 },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <BarChart3 className="w-8 h-8 text-emerald-400" />
              <h1 className="text-4xl font-bold">Analytics</h1>
            </div>

            {/* Time Range Selector */}
            <div className="flex gap-2">
              {(['week', 'month', 'year'] as const).map((range) => (
                <Button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  variant={timeRange === range ? 'primary' : 'secondary'}
                  className="text-sm"
                >
                  {range.charAt(0).toUpperCase() + range.slice(1)}
                </Button>
              ))}
            </div>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {statistics.map((stat) => (
            <div key={stat.title} className="bg-slate-800 rounded-lg p-6 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <div className="text-slate-400">{stat.title}</div>
                <div className="text-emerald-400">{stat.icon}</div>
              </div>
              <div className="text-3xl font-bold mb-2">{stat.value}</div>
              <div
                className={`text-sm font-semibold flex items-center gap-1 ${
                  stat.trend === 'up' ? 'text-emerald-400' : 'text-slate-400'
                }`}
              >
                <TrendingUp className="w-4 h-4" />
                {stat.trend === 'up' ? '+' : ''}{stat.change}% vs last month
              </div>
            </div>
          ))}
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Weekly Chart */}
          <div className="bg-slate-800 rounded-lg p-6 shadow-xl">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-emerald-400" />
              Weekly Progress
            </h2>

            <div className="space-y-4">
              {weeklyData.map((day) => (
                <div key={day.day}>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-semibold">{day.day}</span>
                    <span className="text-sm text-slate-400">
                      {day.completed}/{day.total}
                    </span>
                  </div>
                  <div className="w-full bg-slate-700 rounded-full h-3 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-emerald-400 to-emerald-500 h-full rounded-full transition-all"
                      style={{ width: `${(day.completed / day.total) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Monthly Chart */}
          <div className="bg-slate-800 rounded-lg p-6 shadow-xl">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-emerald-400" />
              Monthly Overview
            </h2>

            <div className="space-y-4">
              {monthlyData.map((week) => (
                <div key={week.week}>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-semibold">{week.week}</span>
                    <span className="text-sm text-slate-400">
                      {week.completed}/{week.total}
                    </span>
                  </div>
                  <div className="w-full bg-slate-700 rounded-full h-4 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-blue-400 to-blue-500 h-full rounded-full transition-all"
                      style={{ width: `${(week.completed / week.total) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Habits Performance */}
        <div className="bg-slate-800 rounded-lg p-6 shadow-xl">
          <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
            <Target className="w-5 h-5 text-emerald-400" />
            Habit Performance
          </h2>

          <div className="space-y-6">
            {habitStats.map((habit) => (
              <div key={habit.name}>
                <div className="flex justify-between items-center mb-3">
                  <span className="font-semibold">{habit.name}</span>
                  <span className="text-sm text-emerald-400 font-bold">{habit.percentage}%</span>
                </div>
                <div className="w-full bg-slate-700 rounded-full h-3 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      habit.percentage >= 80
                        ? 'bg-emerald-500'
                        : habit.percentage >= 60
                        ? 'bg-yellow-500'
                        : 'bg-red-500'
                    }`}
                    style={{ width: `${habit.percentage}%` }}
                  />
                </div>
                <div className="text-xs text-slate-400 mt-2">
                  {habit.completed} out of {habit.total} days completed
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Insights Section */}
        <div className="mt-8 bg-slate-800 rounded-lg p-6 shadow-xl">
          <h2 className="text-xl font-bold mb-6">Insights & Recommendations</h2>

          <div className="space-y-4">
            <div className="p-4 bg-emerald-900/20 border border-emerald-500/30 rounded-lg">
              <div className="font-semibold text-emerald-300 mb-1">Great Progress! 🎉</div>
              <div className="text-sm text-emerald-200">
                You've maintained a 21-day streak! Keep up the amazing work with your morning prayer habit.
              </div>
            </div>

            <div className="p-4 bg-blue-900/20 border border-blue-500/30 rounded-lg">
              <div className="font-semibold text-blue-300 mb-1">Consistency Matters 📈</div>
              <div className="text-sm text-blue-200">
                Your completion rate has increased by 3% this month. Exercise could use more attention - it's at 73%.
              </div>
            </div>

            <div className="p-4 bg-purple-900/20 border border-purple-500/30 rounded-lg">
              <div className="font-semibold text-purple-300 mb-1">Habit Suggestion 💡</div>
              <div className="text-sm text-purple-200">
                Consider pairing your morning prayer with an additional habit for better completion. Many users have success with bundling.
              </div>
            </div>
          </div>
        </div>

        {/* Export Button */}
        <div className="mt-8 text-center">
          <Button variant="primary">
            Download Report (PDF)
          </Button>
        </div>
      </div>
    </div>
  );
};
