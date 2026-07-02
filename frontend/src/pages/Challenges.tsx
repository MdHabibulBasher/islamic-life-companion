import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowRight,
  Calendar,
  CheckCircle2,
  Filter,
  Flame,
  Loader2,
  Lock,
  Sparkles,
  Target,
  Trophy,
  Zap,
} from 'lucide-react'
import { LoadingSpinner } from '../components/Loading'
import { OrnateCard } from '../components/IslamicOrnamentBG'
import {
  challengeService,
  type Challenge,
  type Hadith,
  type Reward,
  type UserChallengeDetailed,
} from '../services/challengeService'

/* ============================================================================
 *  Challenges — browse + join available challenges
 * ----------------------------------------------------------------------------
 *  Three columns on desktop: Active / Available / Completed.
 *  Each card shows name, description, duration, difficulty, and a Join or
 *  Continue action that deep-links to the detail page.
 * ========================================================================= */

type Tab = 'available' | 'active' | 'completed'

const DIFFICULTY_COLORS: Record<string, string> = {
  easy: '#22c55e',
  medium: '#f59e0b',
  hard: '#ef4444',
}

const CATEGORY_LABELS: Record<string, { label: string; color: string }> = {
  quran: { label: 'Quran', color: '#7C3AED' },
  prayer: { label: 'Prayer', color: '#2C5F2D' },
  dhikr: { label: 'Dhikr', color: '#0891b2' },
  character: { label: 'Character', color: '#D97706' },
  health: { label: 'Health', color: '#DC2626' },
  knowledge: { label: 'Knowledge', color: '#0d9488' },
}

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  daily:     { label: 'Daily',     color: '#10b981' },
  streak:    { label: 'Streak',    color: '#f59e0b' },
  learning:  { label: 'Learning',  color: '#7C3AED' },
  spiritual: { label: 'Spiritual', color: '#ec4899' },
  sunnah:    { label: 'Sunnah',    color: '#0891b2' },
  boss:      { label: 'Boss',      color: '#dc2626' },
}

const TIER_COLORS: Record<string, string> = {
  bronze:   '#cd7f32',
  silver:   '#9ca3af',
  gold:     '#d4a017',
  platinum: '#e5e7eb',
  diamond:  '#60a5fa',
}

export const ChallengesPage = () => {
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<Tab>('active')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')

  const { data: challenges, isLoading: loadingChallenges } = useQuery<Challenge[]>({
    queryKey: ['challenges', 'available'],
    queryFn: () => challengeService.getAvailableChallenges(),
  })

  const { data: userChallenges, isLoading: loadingUser } = useQuery<UserChallengeDetailed[]>({
    queryKey: ['challenges', 'progress'],
    queryFn: () => challengeService.getUserChallenges(),
  })

  // Current challenge (the one user should be working on) + motivational hadith
  const { data: currentData } = useQuery({
    queryKey: ['challenges', 'current'],
    queryFn: () => challengeService.getCurrentChallenge(),
  })

  // Reward catalog with per-user unlock status
  const { data: rewards } = useQuery<Reward[]>({
    queryKey: ['challenges', 'rewards'],
    queryFn: () => challengeService.getRewards(),
  })

  const joinMut = useMutation({
    mutationFn: async ({ id }: { id: string; isPrayerRelated?: boolean }) => {
      const result = await challengeService.joinChallenge(id, new Date().toISOString().slice(0, 10))
      return result
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['challenges'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })

  const userByChallengeId = useMemo(() => {
    const map = new Map<string, UserChallengeDetailed>()
    userChallenges?.forEach((uc: UserChallengeDetailed) => map.set(uc.challenge.id, uc))
    return map
  }, [userChallenges])

  const filtered = useMemo(() => {
    if (!challenges) return []
    if (categoryFilter === 'all') return challenges
    return challenges.filter((c) => c.category === categoryFilter)
  }, [challenges, categoryFilter])

  const activeList = filtered.filter(
    (c) => {
      const uc = userByChallengeId.get(c.id)
      return uc && !uc.progress.is_completed
    },
  )
  const completedList = filtered.filter(
    (c) => userByChallengeId.get(c.id)?.progress.is_completed,
  )
  const availableList = filtered.filter((c) => !userByChallengeId.get(c.id))

  const currentList =
    tab === 'active' ? activeList : tab === 'completed' ? completedList : availableList

  const categories = useMemo(() => {
    const set = new Set<string>()
    challenges?.forEach((c) => c.category && set.add(c.category))
    return Array.from(set)
  }, [challenges])

  const isLoading = loadingChallenges || loadingUser

  return (
    <div className="max-w-[1400px] mx-auto px-4 pb-12 pt-4">
      <PageHeader
        active={activeList.length}
        completed={completedList.length}
        available={availableList.length}
      />

      {/* Current challenge hero */}
      <div className="mt-6 px-1">
        <CurrentChallengeHero
          current={currentData?.current ?? null}
          hadith={currentData?.hadith ?? null}
        />
      </div>

      {/* Rewards strip */}
      {rewards && rewards.length > 0 && (
        <div className="mt-6 px-1">
          <RewardsStrip rewards={rewards} />
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center justify-between gap-3 flex-wrap mt-8 mb-6 px-1">
        <div className="flex items-center gap-2 flex-wrap">
          <TabButton
            active={tab === 'active'}
            onClick={() => setTab('active')}
            icon={<Flame size={14} />}
            label={`Active${activeList.length ? ` · ${activeList.length}` : ''}`}
          />
          <TabButton
            active={tab === 'available'}
            onClick={() => setTab('available')}
            icon={<Sparkles size={14} />}
            label={`Available${availableList.length ? ` · ${availableList.length}` : ''}`}
          />
          <TabButton
            active={tab === 'completed'}
            onClick={() => setTab('completed')}
            icon={<CheckCircle2 size={14} />}
            label={`Completed${completedList.length ? ` · ${completedList.length}` : ''}`}
          />
        </div>

        {categories.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <Filter size={14} style={{ color: 'var(--gold-mid)' }} />
            <FilterChip
              active={categoryFilter === 'all'}
              onClick={() => setCategoryFilter('all')}
              label="All"
            />
            {categories.map((cat) => (
              <FilterChip
                key={cat}
                active={categoryFilter === cat}
                onClick={() => setCategoryFilter(cat)}
                label={CATEGORY_LABELS[cat]?.label ?? cat}
                color={CATEGORY_LABELS[cat]?.color}
              />
            ))}
          </div>
        )}
      </div>

      {/* Body */}
      {isLoading ? (
        <LoadingSpinner fullScreen text="Loading challenges…" />
      ) : currentList.length === 0 ? (
        <EmptyState tab={tab} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 px-1">
          {currentList.map((c) => (
            <ChallengeCard
              key={c.id}
              challenge={c}
              userProgress={userByChallengeId.get(c.id)}
              joining={joinMut.isPending && joinMut.variables?.id === c.id}
              onJoin={() =>
                joinMut.mutate({
                  id: c.id,
                })
              }
            />
          ))}
        </div>
      )}

      {joinMut.isError && (
        <p className="text-center text-sm mt-6" style={{ color: '#fca5a5' }}>
          Could not join challenge. Please try again.
        </p>
      )}
    </div>
  )
}

/* ============================================================================
 *  PageHeader
 * ========================================================================= */

const PageHeader: React.FC<{ active: number; completed: number; available: number }> = ({
  active,
  completed,
  available,
}) => (
  <OrnateCard
    variant="dark"
    corners="all"
    topBar
    className="overflow-hidden relative !p-0"
  >
    <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-6 items-center px-6 sm:px-10 py-8">
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Trophy size={18} style={{ color: 'var(--gold-mid)' }} />
          <p
            className="text-[10px] uppercase font-bold"
            style={{
              color: 'var(--gold-mid)',
              letterSpacing: '0.22em',
            }}
          >
            Challenges
          </p>
        </div>
        <h1
          className="text-3xl sm:text-4xl font-bold leading-tight mb-2"
          style={{
            color: 'var(--manuscript-cream)',
            fontFamily: 'Georgia, "Times New Roman", serif',
            textShadow: '0 2px 0 rgba(0,0,0,0.45)',
          }}
        >
          Take on a challenge
        </h1>
        <p
          className="text-sm sm:text-base max-w-xl"
          style={{ color: 'var(--manuscript-cream)', opacity: 0.78 }}
        >
          Start with a simple step, grow step by step — complete a level to unlock the next.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <StatPill label="Active" value={active} />
        <StatPill label="Done" value={completed} />
        <StatPill label="Open" value={available} />
      </div>
    </div>
  </OrnateCard>
)

const StatPill: React.FC<{ label: string; value: number }> = ({ label, value }) => (
  <div
    className="rounded-xl px-4 py-3 text-center min-w-[72px]"
    style={{
      background: 'rgba(212, 160, 23, 0.10)',
      border: '1px solid var(--gold-mid, #d4a017)',
    }}
  >
    <p
      className="text-2xl font-bold tabular-nums leading-none"
      style={{
        color: 'var(--gold-light)',
        fontFamily: 'Georgia, "Times New Roman", serif',
      }}
    >
      {value}
    </p>
    <p
      className="text-[10px] uppercase font-bold mt-1"
      style={{
        color: 'var(--manuscript-cream)',
        opacity: 0.65,
        letterSpacing: '0.18em',
      }}
    >
      {label}
    </p>
  </div>
)

/* ============================================================================
 *  CurrentChallengeHero — the user's "right now" focus
 * ========================================================================= */

const CurrentChallengeHero: React.FC<{
  current: Challenge | null
  hadith: Hadith | null
}> = ({ current, hadith }) => {
  if (!current) {
    return (
      <OrnateCard variant="dark" corners="all" topBar className="!p-6">
        <div className="flex items-center gap-3">
          <Trophy size={22} style={{ color: 'var(--gold-light)' }} />
          <div>
            <p
              className="text-[10px] uppercase font-bold mb-1"
              style={{ color: 'var(--gold-mid)', letterSpacing: '0.22em' }}
            >
              Alhamdulillah
            </p>
            <h2
              className="text-xl font-bold"
              style={{
                color: 'var(--manuscript-cream)',
                fontFamily: 'Georgia, "Times New Roman", serif',
              }}
            >
              You have completed every visible challenge. May Allah accept your prayers.
            </h2>
          </div>
        </div>
      </OrnateCard>
    )
  }

  const typeMeta = TYPE_LABELS[current.challenge_type ?? 'streak']
  const tierColor = TIER_COLORS[current.reward_tier ?? 'bronze'] ?? '#d4a017'

  return (
    <OrnateCard variant="dark" corners="all" topBar className="!p-0 overflow-hidden">
      <div className="px-6 sm:px-10 py-7">
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span
            className="text-[10px] uppercase font-bold px-2 py-1 rounded-full"
            style={{
              background: 'rgba(212, 160, 23, 0.18)',
              color: 'var(--gold-light)',
              border: '1px solid var(--gold-mid)',
              letterSpacing: '0.22em',
            }}
          >
            Current Focus
          </span>
          <span
            className="text-[10px] uppercase font-bold px-2 py-1 rounded-full"
            style={{
              background: `${typeMeta.color}22`,
              color: typeMeta.color,
              border: `1px solid ${typeMeta.color}`,
              letterSpacing: '0.18em',
            }}
          >
            Level {current.level} · {typeMeta.label}
          </span>
          {current.reward_tier && (
            <span
              className="text-[10px] uppercase font-bold px-2 py-1 rounded-full"
              style={{
                background: `${tierColor}22`,
                color: tierColor,
                border: `1px solid ${tierColor}`,
                letterSpacing: '0.18em',
              }}
            >
              {current.reward_tier} tier
            </span>
          )}
        </div>

        <h2
          className="text-2xl sm:text-3xl font-bold mb-2"
          style={{
            color: 'var(--manuscript-cream)',
            fontFamily: 'Georgia, "Times New Roman", serif',
          }}
        >
          {current.icon && <span className="mr-2">{current.icon}</span>}
          {current.name_en}
        </h2>
        {current.description && (
          <p
            className="text-sm sm:text-base max-w-3xl leading-relaxed mb-4"
            style={{ color: 'var(--manuscript-cream)', opacity: 0.85 }}
          >
            {current.description}
          </p>
        )}

        {current.dua_reminder && (
          <p
            className="text-sm italic mb-4 px-4 py-3 rounded-lg"
            style={{
              color: 'var(--gold-light)',
              background: 'rgba(212, 160, 23, 0.07)',
              borderLeft: '3px solid var(--gold-mid)',
              opacity: 0.95,
            }}
          >
            “{current.dua_reminder}”
          </p>
        )}

        {/* Hadith quote */}
        {hadith && (
          <div
            className="mt-4 px-4 py-3 rounded-lg"
            style={{
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(212, 160, 23, 0.25)',
            }}
          >
            <p
              className="text-[9px] uppercase font-bold mb-1"
              style={{ color: 'var(--gold-mid)', letterSpacing: '0.22em' }}
            >
              Hadith
            </p>
            <p
              className="text-sm leading-relaxed italic"
              style={{
                color: 'var(--manuscript-cream)',
                fontFamily: 'Georgia, "Times New Roman", serif',
                opacity: 0.92,
              }}
            >
              “{hadith.text_en}”
            </p>
            {hadith.source && (
              <p
                className="text-[11px] mt-1"
                style={{ color: 'var(--gold-mid)', opacity: 0.8 }}
              >
                — {hadith.source}
              </p>
            )}
          </div>
        )}

        <div className="mt-5">
          <Link
            to={`/challenges/${current.id}`}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full text-sm font-bold uppercase transition-all"
            style={{
              background:
                'linear-gradient(135deg, var(--gold-mid) 0%, var(--gold-light) 100%)',
              color: 'var(--emerald-deep, #064e3b)',
              border: '1px solid var(--gold-deep)',
              letterSpacing: '0.18em',
              textDecoration: 'none',
              boxShadow:
                'inset 0 1px 0 rgba(255,255,255,0.5), 0 3px 8px -3px rgba(154,107,14,0.55)',
            }}
          >
            Continue this challenge
            <ArrowRight size={15} strokeWidth={2.5} />
          </Link>
        </div>
      </div>
    </OrnateCard>
  )
}

/* ============================================================================
 *  RewardsStrip — show what badges / titles are unlockable + which are earned
 * ========================================================================= */

const RewardsStrip: React.FC<{ rewards: Reward[] }> = ({ rewards }) => (
  <OrnateCard variant="dark" corners="all" topBar className="!p-6">
    <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
      <div className="flex items-center gap-2">
        <Trophy size={18} style={{ color: 'var(--gold-mid)' }} />
        <p
          className="text-[10px] uppercase font-bold"
          style={{ color: 'var(--gold-mid)', letterSpacing: '0.22em' }}
        >
          Rewards
        </p>
      </div>
      <p
        className="text-[10px] uppercase font-bold"
        style={{ color: 'var(--manuscript-cream)', opacity: 0.55, letterSpacing: '0.18em' }}
      >
        {rewards.filter((r) => r.is_unlocked).length} / {rewards.length} unlocked
      </p>
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {rewards.map((r) => {
        const tierColor = TIER_COLORS[r.tier] ?? '#d4a017'
        const opacity = r.is_unlocked ? 1 : 0.5
        return (
          <div
            key={r.id}
            className="flex items-center gap-3 p-3 rounded-xl"
            style={{
              background: r.is_unlocked
                ? `${tierColor}18`
                : 'rgba(255, 255, 255, 0.02)',
              border: `1px solid ${r.is_unlocked ? tierColor : 'rgba(212, 160, 23, 0.25)'}`,
              opacity,
            }}
          >
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center text-2xl flex-shrink-0"
              style={{
                background: r.is_unlocked ? `${tierColor}33` : 'rgba(255,255,255,0.04)',
                border: `1px solid ${r.is_unlocked ? tierColor : 'var(--gold-mid)'}`,
              }}
            >
              {r.is_unlocked ? r.icon : '🔒'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p
                  className="text-sm font-bold truncate"
                  style={{
                    color: r.is_unlocked ? tierColor : 'var(--manuscript-cream)',
                    fontFamily: 'Georgia, "Times New Roman", serif',
                  }}
                >
                  {r.name_en}
                </p>
                <span
                  className="text-[9px] uppercase font-bold px-2 py-0.5 rounded-full"
                  style={{
                    background: `${tierColor}22`,
                    color: tierColor,
                    border: `1px solid ${tierColor}`,
                    letterSpacing: '0.16em',
                  }}
                >
                  {r.tier}
                </span>
              </div>
              {r.description && (
                <p
                  className="text-[11px] mt-1 leading-snug"
                  style={{ color: 'var(--manuscript-cream)', opacity: 0.7 }}
                >
                  {r.description}
                </p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  </OrnateCard>
)

/* ============================================================================
 *  TabButton + FilterChip
 * ========================================================================= */

const TabButton: React.FC<{
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
}> = ({ active, onClick, icon, label }) => (
  <button
    onClick={onClick}
    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold uppercase transition-all"
    style={{
      background: active
        ? 'linear-gradient(135deg, var(--gold-mid) 0%, var(--gold-light) 100%)'
        : 'rgba(255, 255, 255, 0.04)',
      color: active ? 'var(--emerald-deep, #064e3b)' : 'var(--manuscript-cream)',
      border: active
        ? '1px solid var(--gold-deep)'
        : '1px solid var(--gold-mid, #d4a017)',
      letterSpacing: '0.16em',
      boxShadow: active
        ? 'inset 0 1px 0 rgba(255,255,255,0.5), 0 3px 8px -3px rgba(154,107,14,0.55)'
        : 'none',
    }}
  >
    {icon}
    {label}
  </button>
)

const FilterChip: React.FC<{
  active: boolean
  onClick: () => void
  label: string
  color?: string
}> = ({ active, onClick, label, color }) => (
  <button
    onClick={onClick}
    className="px-3 py-1 rounded-full text-[11px] font-bold uppercase transition-all"
    style={{
      background: active
        ? color
          ? `${color}33`
          : 'rgba(212, 160, 23, 0.18)'
        : 'rgba(255,255,255,0.04)',
      color: active ? color ?? 'var(--gold-light)' : 'var(--manuscript-cream)',
      border: `1px solid ${active ? color ?? 'var(--gold-mid)' : 'var(--gold-mid, #d4a017)'}`,
      letterSpacing: '0.14em',
      opacity: active ? 1 : 0.7,
    }}
  >
    {label}
  </button>
)

/* ============================================================================
 *  ChallengeCard
 * ========================================================================= */

const ChallengeCard: React.FC<{
  challenge: Challenge
  userProgress?: UserChallengeDetailed
  joining: boolean
  onJoin: () => void
}> = ({ challenge, userProgress, joining, onJoin }) => {
  const difficultyColor =
    DIFFICULTY_COLORS[challenge.difficulty?.toLowerCase()] ?? 'var(--gold-mid)'
  const categoryMeta =
    CATEGORY_LABELS[challenge.category ?? ''] ?? null

  return (
    <OrnateCard
      variant="dark"
      corners="all"
      topBar
      className="!p-5 flex flex-col h-full"
    >
      {/* Top row: icon + difficulty */}
      <div className="flex items-start justify-between mb-3">
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center"
          style={{
            background: 'rgba(212, 160, 23, 0.12)',
            border: '1px solid var(--gold-mid)',
            color: 'var(--gold-light)',
          }}
        >
          <Target size={20} />
        </div>
        {userProgress?.progress.is_completed ? (
          <span
            className="inline-flex items-center gap-1 text-[9px] font-bold uppercase px-2 py-1 rounded-full"
            style={{
              background: 'rgba(34, 197, 94, 0.15)',
              color: '#22c55e',
              border: '1px solid #22c55e',
              letterSpacing: '0.16em',
            }}
          >
            <CheckCircle2 size={10} strokeWidth={2.5} />
            Done
          </span>
        ) : userProgress ? (
          <span
            className="inline-flex items-center gap-1 text-[9px] font-bold uppercase px-2 py-1 rounded-full"
            style={{
              background: 'rgba(245, 158, 11, 0.15)',
              color: '#f59e0b',
              border: '1px solid #f59e0b',
              letterSpacing: '0.16em',
            }}
          >
            <Flame size={10} strokeWidth={2.5} />
            Active · {userProgress.progress.current_streak}d
          </span>
        ) : (
          <span
            className="inline-flex items-center gap-1 text-[9px] font-bold uppercase px-2 py-1 rounded-full"
            style={{
              background: `${difficultyColor}22`,
              color: difficultyColor,
              border: `1px solid ${difficultyColor}`,
              letterSpacing: '0.16em',
            }}
          >
            <Zap size={10} strokeWidth={2.5} />
            {challenge.difficulty ?? 'Medium'}
          </span>
        )}
      </div>

      <h3
        className="text-lg font-bold mb-1.5"
        style={{
          color: 'var(--gold-light)',
          fontFamily: 'Georgia, "Times New Roman", serif',
          letterSpacing: '0.01em',
        }}
      >
        {challenge.name_en}
      </h3>

      {challenge.description && (
        <p
          className="text-xs leading-relaxed mb-4 flex-1"
          style={{ color: 'var(--manuscript-cream)', opacity: 0.78 }}
        >
          {challenge.description}
        </p>
      )}

      {/* Meta row */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <span
          className="inline-flex items-center gap-1 text-[9px] font-bold uppercase px-2 py-0.5 rounded-full"
          style={{
            background: 'rgba(212, 160, 23, 0.18)',
            color: 'var(--gold-light)',
            border: '1px solid var(--gold-mid)',
            letterSpacing: '0.16em',
          }}
        >
          <Sparkles size={10} strokeWidth={2.5} />
          Level {challenge.level ?? 1}
        </span>
        {challenge.challenge_type && TYPE_LABELS[challenge.challenge_type] && (
          <span
            className="inline-flex items-center gap-1 text-[9px] font-bold uppercase px-2 py-0.5 rounded-full"
            style={{
              background: `${TYPE_LABELS[challenge.challenge_type].color}22`,
              color: TYPE_LABELS[challenge.challenge_type].color,
              border: `1px solid ${TYPE_LABELS[challenge.challenge_type].color}`,
              letterSpacing: '0.14em',
            }}
          >
            {TYPE_LABELS[challenge.challenge_type].label}
          </span>
        )}
        {challenge.reward_tier && (
          <span
            className="inline-flex items-center gap-1 text-[9px] font-bold uppercase px-2 py-0.5 rounded-full"
            style={{
              background: `${TIER_COLORS[challenge.reward_tier] ?? '#d4a017'}22`,
              color: TIER_COLORS[challenge.reward_tier] ?? '#d4a017',
              border: `1px solid ${TIER_COLORS[challenge.reward_tier] ?? '#d4a017'}`,
              letterSpacing: '0.14em',
            }}
          >
            {challenge.reward_tier}
          </span>
        )}
        <span
          className="inline-flex items-center gap-1 text-[10px] uppercase font-bold"
          style={{ color: 'var(--manuscript-cream)', opacity: 0.7 }}
        >
          <Calendar size={11} />
          {challenge.duration_days} days
        </span>
      </div>

      {challenge.dua_reminder && (
        <p
          className="text-[10px] italic mb-3 px-2 py-1.5 rounded-lg"
          style={{
            color: 'var(--gold-light)',
            background: 'rgba(212, 160, 23, 0.06)',
            borderLeft: '2px solid var(--gold-mid)',
            opacity: 0.92,
          }}
        >
          “{challenge.dua_reminder}”
        </p>
      )}

      {categoryMeta && (
          <span
            className="text-[9px] font-bold uppercase px-2 py-0.5 rounded-full"
            style={{
              background: `${categoryMeta.color}33`,
              color: categoryMeta.color,
              border: `1px solid ${categoryMeta.color}88`,
              letterSpacing: '0.14em',
            }}
          >
            {categoryMeta.label}
          </span>
        )}

      {/* Action */}
      <div className="mt-auto">
        {userProgress ? (
          <Link
            to={`/challenges/${challenge.id}`}
            className="inline-flex items-center justify-center gap-2 w-full px-4 py-2 rounded-full text-xs font-bold uppercase transition-all"
            style={{
              background:
                'linear-gradient(135deg, var(--gold-mid) 0%, var(--gold-light) 100%)',
              color: 'var(--emerald-deep, #064e3b)',
              border: '1px solid var(--gold-deep)',
              letterSpacing: '0.18em',
              textDecoration: 'none',
              boxShadow:
                'inset 0 1px 0 rgba(255,255,255,0.5), 0 3px 8px -3px rgba(154,107,14,0.55)',
            }}
          >
            Continue
            <ArrowRight size={13} strokeWidth={2.5} />
          </Link>
        ) : (
          <button
            onClick={onJoin}
            disabled={joining}
            className="inline-flex items-center justify-center gap-2 w-full px-4 py-2 rounded-full text-xs font-bold uppercase transition-all disabled:opacity-50"
            style={{
              background:
                'linear-gradient(135deg, var(--gold-mid) 0%, var(--gold-light) 100%)',
              color: 'var(--emerald-deep, #064e3b)',
              border: '1px solid var(--gold-deep)',
              letterSpacing: '0.18em',
              boxShadow:
                'inset 0 1px 0 rgba(255,255,255,0.5), 0 3px 8px -3px rgba(154,107,14,0.55)',
            }}
          >
            {joining ? (
              <>
                <Loader2 size={13} className="animate-spin" strokeWidth={2.5} />
                Joining…
              </>
            ) : (
              <>
                Join challenge
                <ArrowRight size={13} strokeWidth={2.5} />
              </>
            )}
          </button>
        )}
      </div>

      {challenge.reward && (
        <p
          className="text-[10px] mt-3 text-center"
          style={{
            color: 'var(--gold-mid)',
            fontStyle: 'italic',
            opacity: 0.85,
          }}
        >
          Reward: {challenge.reward}
        </p>
      )}
    </OrnateCard>
  )
}

/* ============================================================================
 *  EmptyState
 * ========================================================================= */

const EmptyState: React.FC<{ tab: Tab }> = ({ tab }) => {
  const message =
    tab === 'completed'
      ? "You haven't completed any challenges yet — but every journey begins with a single step."
      : tab === 'active'
        ? "You're not in any active challenge right now. Browse the Available tab to begin."
        : 'No challenges available right now. Check back soon, in shaa Allah.'

  return (
    <OrnateCard
      variant="dark"
      corners="all"
      topBar
      className="!p-10 text-center max-w-xl mx-auto"
    >
      <div
        className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center"
        style={{
          background: 'rgba(212, 160, 23, 0.10)',
          border: '1px solid var(--gold-mid)',
          color: 'var(--gold-mid)',
        }}
      >
        <Lock size={26} />
      </div>
      <p
        className="text-base"
        style={{
          color: 'var(--manuscript-cream)',
          fontFamily: 'Georgia, serif',
          opacity: 0.85,
        }}
      >
        {message}
      </p>
    </OrnateCard>
  )
}

export default ChallengesPage