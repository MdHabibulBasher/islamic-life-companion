import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Bell, Trash2, Check, AlertCircle, CheckCheck } from 'lucide-react'
import { Button } from '../components/Form'
import {
  notificationService,
  type AppNotification,
} from '../services/appNotificationService'
import { useToast } from '../components/Toast'
import {
  OrnateCard,
  PageHeader,
  GoldDivider,
  Star8,
} from '../components/IslamicOrnamentBG'

type FilterType = 'all' | 'habit' | 'challenge' | 'prayer' | 'achievement' | 'system'

const TYPE_TINT: Record<string, { color: string; bg: string; border: string; label: string }> = {
  habit: {
    color: 'var(--lapiz, #1e3a8a)',
    bg: 'linear-gradient(135deg, rgba(30,58,138,0.10) 0%, rgba(212,160,23,0.05) 100%)',
    border: 'var(--lapiz, #1e3a8a)',
    label: 'Habit',
  },
  challenge: {
    color: 'var(--crimson, #b91c1c)',
    bg: 'linear-gradient(135deg, rgba(185,28,28,0.10) 0%, rgba(212,160,23,0.05) 100%)',
    border: 'var(--crimson, #b91c1c)',
    label: 'Challenge',
  },
  prayer: {
    color: 'var(--emerald)',
    bg: 'linear-gradient(135deg, rgba(16,122,87,0.10) 0%, rgba(212,160,23,0.05) 100%)',
    border: 'var(--emerald)',
    label: 'Prayer',
  },
  achievement: {
    color: 'var(--gold-deep)',
    bg: 'linear-gradient(135deg, rgba(154,107,14,0.10) 0%, rgba(212,160,23,0.05) 100%)',
    border: 'var(--gold-deep)',
    label: 'Achievement',
  },
  system: {
    color: 'var(--gold-deep)',
    bg: 'linear-gradient(135deg, rgba(154,107,14,0.08) 0%, rgba(212,160,23,0.04) 100%)',
    border: 'var(--gold-mid)',
    label: 'System',
  },
}

const FILTER_TYPES: { id: FilterType; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'habit', label: 'Habit' },
  { id: 'challenge', label: 'Challenge' },
  { id: 'prayer', label: 'Prayer' },
  { id: 'achievement', label: 'Achievement' },
  { id: 'system', label: 'System' },
]

export const Notifications: React.FC = () => {
  const queryClient = useQueryClient()
  const { error: showError, success: showSuccess } = useToast()
  const [filterType, setFilterType] = useState<FilterType>('all')
  const [showOnlyUnread, setShowOnlyUnread] = useState(false)

  const {
    data: notificationsList = [],
    isLoading,
    isError,
  } = useQuery<AppNotification[]>({
    queryKey: ['notifications'],
    queryFn: () => notificationService.list(),
  })

  const markReadMutation = useMutation({
    mutationFn: (id: number) => notificationService.markAsRead(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  })

  const markAllReadMutation = useMutation({
    mutationFn: () => notificationService.markAllAsRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
      showSuccess('All notifications marked as read')
    },
    onError: () => showError('Failed to mark notifications'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => notificationService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
      showSuccess('Notification deleted')
    },
    onError: () => showError('Failed to delete notification'),
  })

  const filteredNotifications = notificationsList.filter((notif) => {
    const typeMatch = filterType === 'all' || notif.notification_type === filterType
    const readMatch = !showOnlyUnread || !notif.is_read
    return typeMatch && readMatch
  })

  const unreadCount = notificationsList.filter((n) => !n.is_read).length

  const formatTimestamp = (iso: string) => {
    const date = new Date(iso)
    const diffMs = Date.now() - date.getTime()
    const mins = Math.floor(diffMs / 60000)
    if (mins < 1) return 'Just now'
    if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`
    const days = Math.floor(hours / 24)
    if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`
    return date.toLocaleDateString()
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 md:pt-0">
      <PageHeader
        title="Notifications"
        ornament={<Bell size={26} />}
        actions={
          <Button
            variant="primary"
            onClick={() => markAllReadMutation.mutate()}
            disabled={unreadCount === 0 || markAllReadMutation.isPending}
          >
            <CheckCheck size={18} className="mr-2" />
            Mark all read
          </Button>
        }
      />

      {unreadCount > 0 && (
        <p
          className="text-xs uppercase tracking-[0.18em] font-semibold mb-4"
          style={{ color: 'var(--gold-deep)' }}
        >
          {unreadCount} unread message{unreadCount === 1 ? '' : 's'}
        </p>
      )}

      {isError && (
        <OrnateCard topBar corners="all" className="!p-4 mb-6 flex items-center gap-2">
          <AlertCircle size={20} style={{ color: 'var(--missed, #e44244)' }} />
          <span style={{ color: 'var(--missed, #e44244)' }}>
            Failed to load notifications.
          </span>
        </OrnateCard>
      )}

      <OrnateCard topBar corners="all" className="!p-4 mb-6">
        <div className="flex flex-wrap gap-2 mb-3">
          {FILTER_TYPES.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilterType(f.id)}
              className="px-3 py-1.5 rounded-xl text-sm font-semibold capitalize transition"
              style={
                filterType === f.id
                  ? {
                      background:
                        'linear-gradient(135deg, var(--gold-mid) 0%, var(--gold-light) 100%)',
                      color: 'var(--emerald-deep)',
                      border: '1px solid var(--gold-deep)',
                    }
                  : {
                      background:
                        'linear-gradient(180deg, var(--manuscript-cream) 0%, var(--manuscript-cream-2) 100%)',
                      color: 'var(--gold-deep)',
                      border: '1px solid var(--gold-mid)',
                    }
              }
            >
              {f.label}
            </button>
          ))}
        </div>
        <label
          className="flex items-center gap-2 text-sm"
          style={{ color: 'var(--emerald-deep)', fontFamily: 'Georgia, "Times New Roman", serif' }}
        >
          <input
            type="checkbox"
            checked={showOnlyUnread}
            onChange={(e) => setShowOnlyUnread(e.target.checked)}
            className="rounded"
            style={{ accentColor: 'var(--gold-mid)' }}
          />
          Show only unread
        </label>
      </OrnateCard>

      <div className="space-y-3">
        {isLoading ? (
          <OrnateCard topBar corners="all" className="!p-8 text-center">
            <p style={{ color: 'var(--gold-deep)' }}>Loading notifications…</p>
          </OrnateCard>
        ) : filteredNotifications.length === 0 ? (
          <OrnateCard topBar corners="all" className="!p-12 text-center">
            <Star8 size={48} className="mx-auto mb-3" color="var(--gold-deep)" />
            <p
              className="text-lg"
              style={{
                color: 'var(--emerald-deep)',
                fontFamily: 'Georgia, "Times New Roman", serif',
              }}
            >
              {notificationsList.length === 0
                ? "You don't have any notifications yet."
                : 'No notifications match your filters.'}
            </p>
          </OrnateCard>
        ) : (
          filteredNotifications.map((notif) => {
            const tint =
              TYPE_TINT[notif.notification_type] ?? {
                color: 'var(--gold-deep)',
                bg: 'var(--manuscript-cream-2)',
                border: 'var(--gold-mid)',
                label: notif.notification_type,
              }
            return (
              <div
                key={notif.id}
                className="rounded-2xl p-[1px]"
                style={{
                  background:
                    'linear-gradient(135deg, var(--gold-mid) 0%, var(--gold-deep) 100%)',
                  opacity: notif.is_read ? 0.65 : 1,
                }}
              >
                <div
                  className="rounded-2xl p-4 flex items-start gap-3"
                  style={{
                    background: tint.bg,
                    borderLeft: `4px solid ${tint.border}`,
                  }}
                >
                  <div
                    className="px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-[0.16em] flex-shrink-0"
                    style={{
                      background: tint.color,
                      color: 'var(--text-on-glass)',
                      letterSpacing: '0.16em',
                    }}
                  >
                    {tint.label}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3
                        className="font-semibold"
                        style={{
                          color: 'var(--emerald-deep)',
                          fontFamily: 'Georgia, "Times New Roman", serif',
                        }}
                      >
                        {notif.title}
                      </h3>
                      {!notif.is_read && (
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ background: 'var(--gold-mid)' }}
                        />
                      )}
                    </div>
                    <p
                      className="text-sm"
                      style={{ color: 'var(--emerald-deep)', opacity: 0.9 }}
                    >
                      {notif.message}
                    </p>
                    <p
                      className="text-xs mt-1"
                      style={{ color: 'var(--gold-deep)', opacity: 0.8 }}
                    >
                      {formatTimestamp(notif.created_at)}
                    </p>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    {!notif.is_read && (
                      <button
                        onClick={() => markReadMutation.mutate(notif.id)}
                        className="p-2 rounded-xl transition"
                        title="Mark as read"
                        style={{
                          background: 'var(--manuscript-cream)',
                          color: 'var(--emerald)',
                          border: '1px solid var(--gold-mid)',
                        }}
                      >
                        <Check size={16} />
                      </button>
                    )}
                    <button
                      onClick={() => deleteMutation.mutate(notif.id)}
                      className="p-2 rounded-xl transition"
                      title="Delete"
                      style={{
                        background: 'var(--manuscript-cream)',
                        color: 'var(--missed, #e44244)',
                        border: '1px solid var(--gold-mid)',
                      }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      <GoldDivider className="my-6" />
    </div>
  )
}
