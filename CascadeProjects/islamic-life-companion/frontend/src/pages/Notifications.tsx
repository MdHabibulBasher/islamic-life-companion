import React, { useState } from 'react';
import { Bell, Trash2, Check } from 'lucide-react';
import { Button } from '../components/Form';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'habit' | 'challenge' | 'prayer' | 'achievement' | 'system';
  timestamp: string;
  read: boolean;
  actionUrl?: string;
}

export const Notifications: React.FC = () => {
  const [notificationsList, setNotificationsList] = useState<Notification[]>([
    {
      id: '1',
      title: 'Habit Reminder',
      message: 'Time to complete your morning prayer habit!',
      type: 'habit',
      timestamp: '5 minutes ago',
      read: false,
      actionUrl: '/habits',
    },
    {
      id: '2',
      title: 'Challenge Update',
      message: 'Ahmed Hassan has completed day 30 of "30 Days of Quran Reading"',
      type: 'challenge',
      timestamp: '2 hours ago',
      read: false,
      actionUrl: '/challenges/1',
    },
    {
      id: '3',
      title: 'Prayer Time',
      message: 'Dhuhr prayer is in 30 minutes',
      type: 'prayer',
      timestamp: '3 hours ago',
      read: false,
    },
    {
      id: '4',
      title: 'Achievement Unlocked! 🎉',
      message: 'You\'ve earned the "7-Day Streak" achievement',
      type: 'achievement',
      timestamp: '1 day ago',
      read: true,
    },
    {
      id: '5',
      title: 'New Challenge Available',
      message: 'Check out the new "40 Days of Meditation" challenge',
      type: 'challenge',
      timestamp: '2 days ago',
      read: true,
      actionUrl: '/challenges',
    },
    {
      id: '6',
      title: 'System Maintenance',
      message: 'We\'ve updated the app with new features and improvements',
      type: 'system',
      timestamp: '3 days ago',
      read: true,
    },
  ]);

  const [filterType, setFilterType] = useState<'all' | 'habit' | 'challenge' | 'prayer' | 'achievement' | 'system'>('all');
  const [showOnlyUnread, setShowOnlyUnread] = useState(false);

  const filteredNotifications = notificationsList.filter((notif) => {
    const typeMatch = filterType === 'all' || notif.type === filterType;
    const readMatch = !showOnlyUnread || !notif.read;
    return typeMatch && readMatch;
  });

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'habit':
        return 'bg-blue-900/30 border-blue-500/30 text-blue-300';
      case 'challenge':
        return 'bg-purple-900/30 border-purple-500/30 text-purple-300';
      case 'prayer':
        return 'bg-emerald-900/30 border-emerald-500/30 text-emerald-300';
      case 'achievement':
        return 'bg-yellow-900/30 border-yellow-500/30 text-yellow-300';
      case 'system':
        return 'bg-slate-700/30 border-slate-500/30 text-slate-300';
      default:
        return 'bg-slate-900/30 border-slate-500/30 text-slate-300';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'habit':
        return '📋';
      case 'challenge':
        return '🏆';
      case 'prayer':
        return '🕌';
      case 'achievement':
        return '⭐';
      case 'system':
        return '⚙️';
      default:
        return '🔔';
    }
  };

  const handleMarkAsRead = (id: string) => {
    setNotificationsList((prev) =>
      prev.map((notif) => (notif.id === id ? { ...notif, read: true } : notif))
    );
  };

  const handleMarkAllAsRead = () => {
    setNotificationsList((prev) => prev.map((notif) => ({ ...notif, read: true })));
  };

  const handleDelete = (id: string) => {
    setNotificationsList((prev) => prev.filter((notif) => notif.id !== id));
  };

  const handleDeleteAll = () => {
    setNotificationsList([]);
  };

  const unreadCount = notificationsList.filter((notif) => !notif.read).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white p-4">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Bell className="w-8 h-8 text-emerald-400" />
              <div>
                <h1 className="text-4xl font-bold">Notifications</h1>
                {unreadCount > 0 && (
                  <p className="text-sm text-slate-400">{unreadCount} unread</p>
                )}
              </div>
            </div>

            {notificationsList.length > 0 && (
              <div className="flex gap-2">
                <Button variant="secondary" onClick={handleMarkAllAsRead} className="text-sm">
                  Mark All as Read
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="mb-6 space-y-4">
          {/* Type Filters */}
          <div className="flex gap-2 flex-wrap">
            {(['all', 'habit', 'challenge', 'prayer', 'achievement', 'system'] as const).map((type) => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`px-4 py-2 rounded-lg font-semibold transition ${
                  filterType === type
                    ? 'bg-emerald-500 text-white'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </button>
            ))}
          </div>

          {/* Unread Filter */}
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="unread-only"
              checked={showOnlyUnread}
              onChange={(e) => setShowOnlyUnread(e.target.checked)}
              className="w-4 h-4 cursor-pointer"
            />
            <label htmlFor="unread-only" className="cursor-pointer text-sm">
              Show only unread
            </label>
          </div>
        </div>

        {/* Notifications List */}
        {filteredNotifications.length > 0 ? (
          <div className="space-y-3 mb-8">
            {filteredNotifications.map((notification) => (
              <div
                key={notification.id}
                className={`p-4 rounded-lg border transition ${
                  notification.read
                    ? 'bg-slate-700/30 border-slate-600/30'
                    : `bg-slate-700 border-slate-500 ${getTypeColor(notification.type)}`
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4 flex-1">
                    <div className="text-2xl mt-1">{getTypeIcon(notification.type)}</div>
                    <div className="flex-1">
                      <h3 className="font-semibold mb-1">{notification.title}</h3>
                      <p className="text-slate-300 text-sm mb-2">{notification.message}</p>
                      <div className="text-xs text-slate-400">{notification.timestamp}</div>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    {notification.actionUrl && (
                      <Button variant="secondary" className="text-xs">
                        View
                      </Button>
                    )}
                    {!notification.read && (
                      <button
                        onClick={() => handleMarkAsRead(notification.id)}
                        className="p-2 rounded hover:bg-slate-600 transition"
                        title="Mark as read"
                      >
                        <Check className="w-4 h-4 text-emerald-400" />
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(notification.id)}
                      className="p-2 rounded hover:bg-slate-600 transition"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4 text-red-400" />
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {notificationsList.length > filteredNotifications.length && (
              <div className="text-center py-4 text-slate-400 text-sm">
                Showing {filteredNotifications.length} of {notificationsList.length} notifications
              </div>
            )}

            {notificationsList.length > 0 && (
              <div className="text-center">
                <Button
                  variant="secondary"
                  onClick={handleDeleteAll}
                  className="text-red-400 hover:text-red-300 text-sm"
                >
                  Clear All
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-slate-800 rounded-lg p-12 text-center">
            <Bell className="w-16 h-16 mx-auto mb-4 text-slate-600" />
            <h2 className="text-xl font-bold mb-2">No Notifications</h2>
            <p className="text-slate-400 mb-6">
              {showOnlyUnread
                ? 'You\'re all caught up! No unread notifications.'
                : 'You\'ll see notifications here when something happens.'}
            </p>
            {showOnlyUnread && (
              <Button onClick={() => setShowOnlyUnread(false)} variant="primary">
                Show All Notifications
              </Button>
            )}
          </div>
        )}

        {/* Notification Settings Link */}
        <div className="bg-slate-800 rounded-lg p-6 text-center">
          <p className="text-slate-300 mb-4">
            Customize your notification preferences in
          </p>
          <Button variant="secondary" className="inline-flex items-center gap-2">
            Go to Settings
          </Button>
        </div>
      </div>
    </div>
  );
};
