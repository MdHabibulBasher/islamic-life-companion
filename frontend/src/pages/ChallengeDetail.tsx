import React, { useMemo, useState } from 'react'
import {
  ChevronLeft, Calendar, Target, TrendingUp, Share2, Loader2,
} from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  challengeService,
  type Challenge,
  type UserChallengeDetailed,
} from '../services/challengeService'
import { Button } from '../components/Form'
import {
  OrnateCard,
  ManuscriptSection,
  GoldDivider,
  Star8,
} from '../components/IslamicOrnamentBG'
import { LoadingSpinner } from '../components/Loading'

const DIFFICULTY_COLORS: Record<string, string> = {
  easy: '#22c55e',
  medium: '#f59e0b',
  hard: '#ef4444',
}

export const ChallengeDetail: React.FC = () => {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const queryClient = useQueryClient()
  const [shareCopied, setShareCopied] = useState(false)
  const [justCompleted, setJustCompleted] = useState(false)

  /* ------------------------------------------------------------------------
   *  Data fetching — challenge + user progress
   * ---------------------------------------------------------------------- */
  const { data: challenges } = useQuery<Challenge[]>({
    queryKey: ['challenges', 'all'],
    queryFn: () => challengeService.getChallenges(),
  })

  const { data: userChallenges, isLoading: loadingProgress } = useQuery<UserChallengeDetailed[]>({
    queryKey: ['challenges', 'progress'],
    queryFn: () => challengeService.getUserChallenges(),
  })

  const challenge: Challenge | undefined = useMemo(
    () => challenges?.find((c) => c.id === id),
    [challenges, id],
  )

  const userProgress: UserChallengeDetailed | undefined = useMemo(
    () => userChallenges?.find((uc) => uc.challenge.id === id),
    [userChallenges, id],
  )

  const isParticipating = !!userProgress

  /* ------------------------------------------------------------------------
   *  Mutations
   * ---------------------------------------------------------------------- */
  const recordMut = useMutation({
    mutationFn: async () => {
      const today = new Date().toISOString().slice(0, 10)
      await challengeService.toggleChallengeCompletion(id!, today)
    },
    onSuccess: () => {
      // Refresh every cache that depends on completion state
      queryClient.invalidateQueries({ queryKey: ['challenges', 'progress'] })
      queryClient.invalidateQueries({ queryKey: ['challenges'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      // Briefly show the Alhamdulillah banner
      setJustCompleted(true)
      window.setTimeout(() => setJustCompleted(false), 6000)
    },
  })

  const leaveMut = useMutation({
    mutationFn: () => challengeService.leaveChallenge(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['challenges'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      // Send user back to the list after leaving
      navigate('/challenges')
    },
  })

  if (!id) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center">
        <p style={{ color: 'var(--text-on-glass)' }}>Challenge not found.</p>
        <button
          onClick={() => navigate('/challenges')}
          className="mt-4 underline"
          style={{ color: 'var(--gold-light)' }}
        >
          Back to challenges
        </button>
      </div>
    )
  }

  if (!challenge || loadingProgress) {
    return <LoadingSpinner fullScreen text="Loading challenge…" />
  }

  /* ------------------------------------------------------------------------
   *  Derived values
   * ---------------------------------------------------------------------- */
  const completions = userProgress?.completions ?? []
  const progressCount = completions.length
  const goal = challenge.duration_days
  const isCompleted = userProgress?.progress.is_completed ?? false
  const currentStreak = userProgress?.progress.current_streak ?? 0
  const difficultyColor =
    DIFFICULTY_COLORS[challenge.difficulty?.toLowerCase()] ?? 'var(--gold-mid)'

  const completedToday = completions.some(
    (c) => c.completion_date === new Date().toISOString().slice(0, 10),
  )

  const handleShare = async () => {
    const url = window.location.href
    try {
      if (navigator.share) {
        await navigator.share({
          title: challenge.name_en,
          text: challenge.description ?? '',
          url,
        })
      } else {
        await navigator.clipboard.writeText(url)
        setShareCopied(true)
        setTimeout(() => setShareCopied(false), 2000)
      }
    } catch {
      /* user cancelled share */
    }
  }

  const handleLeave = () => {
    if (window.confirm(`Leave "${challenge.name_en}"? Your progress will be removed.`)) {
      leaveMut.mutate()
    }
  }

  return (
    <div className="max-w-[1400px] mx-auto px-4 pb-12 pt-4">
      <div className="max-w-3xl mx-auto">
      {/* Back row */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1 mb-4 text-sm font-semibold"
        style={{ color: 'var(--gold-mid)' }}
      >
        <ChevronLeft className="w-4 h-4" />
        Back
      </button>

      {/* Celebration banner — appears after Mark Today Done */}
      {justCompleted && (
        <div
          role="status"
          aria-live="polite"
          className="mb-4 px-5 py-4 rounded-2xl text-center"
          style={{
            background:
              'linear-gradient(180deg, rgba(212, 160, 23, 0.18) 0%, rgba(212, 160, 23, 0.06) 100%)',
            border: '1px solid var(--gold-mid)',
            boxShadow: '0 0 24px -8px rgba(212, 160, 23, 0.45)',
          }}
        >
          <p
            className="text-base sm:text-lg font-bold"
            style={{
              color: 'var(--gold-light)',
              fontFamily: 'Georgia, "Times New Roman", serif',
            }}
          >
            Alhamdulillah — your deed is recorded.
          </p>
          <p
            className="text-xs mt-1"
            style={{ color: 'var(--text-on-glass)', opacity: 0.82 }}
          >
            May Allah accept your prayers and keep you steadfast.
          </p>
        </div>
      )}

      {/* ============================ HERO CARD ============================= */}
      <OrnateCard
        variant="dark"
        corners="all"
        topBar
        className="overflow-hidden !p-0 mb-6"
      >
        <div className="px-6 sm:px-10 py-8">
          <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
            <div className="flex-1 min-w-[260px]">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span
                  className="inline-flex items-center gap-1 text-[9px] font-bold uppercase px-2 py-1 rounded-full"
                  style={{
                    background: 'rgba(212, 160, 23, 0.18)',
                    color: 'var(--gold-light)',
                    border: '1px solid var(--gold-mid)',
                    letterSpacing: '0.18em',
                  }}
                >
                  Level {challenge.level ?? 1}
                </span>
                <span
                  className="inline-flex items-center gap-1 text-[9px] font-bold uppercase px-2 py-1 rounded-full"
                  style={{
                    background: `${difficultyColor}22`,
                    color: difficultyColor,
                    border: `1px solid ${difficultyColor}`,
                    letterSpacing: '0.16em',
                  }}
                >
                  {challenge.difficulty}
                </span>
                {isParticipating && (
                  <span
                    className="inline-flex items-center gap-1 text-[9px] font-bold uppercase px-2 py-1 rounded-full"
                    style={{
                      background: isCompleted
                        ? 'rgba(34, 197, 94, 0.15)'
                        : 'rgba(245, 158, 11, 0.15)',
                      color: isCompleted ? '#22c55e' : '#f59e0b',
                      border: `1px solid ${isCompleted ? '#22c55e' : '#f59e0b'}`,
                      letterSpacing: '0.16em',
                    }}
                  >
                    {isCompleted ? '✓ Completed' : `Active · ${currentStreak}d streak`}
                  </span>
                )}
              </div>

              <p
                className="text-[10px] uppercase font-bold mb-2"
                style={{
                  color: 'var(--gold-mid)',
                  letterSpacing: '0.22em',
                }}
              >
                {challenge.category ?? 'Challenge'}
              </p>

              <h1
                className="text-3xl sm:text-4xl font-bold leading-tight mb-3"
                style={{
                  color: 'var(--text-on-glass)',
                  fontFamily: 'Georgia, "Times New Roman", serif',
                  textShadow: '0 2px 0 rgba(0,0,0,0.45)',
                }}
              >
                {challenge.name_en}
              </h1>

              {challenge.description && (
                <p
                  className="text-sm sm:text-base max-w-2xl leading-relaxed"
                  style={{ color: 'var(--text-on-glass)', opacity: 0.82 }}
                >
                  {challenge.description}
                </p>
              )}
            </div>

            <div
              className="rounded-xl px-5 py-4 text-center"
              style={{
                background: 'rgba(212, 160, 23, 0.10)',
                border: '1px solid var(--gold-mid)',
                minWidth: '140px',
              }}
            >
              <div
                className="text-2xl font-bold leading-none"
                style={{
                  color: 'var(--gold-light)',
                  fontFamily: 'Georgia, "Times New Roman", serif',
                }}
              >
                {goal}
              </div>
              <div
                className="text-[10px] uppercase font-bold mt-1"
                style={{
                  color: 'var(--text-on-glass)',
                  opacity: 0.7,
                  letterSpacing: '0.18em',
                }}
              >
                Days
              </div>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
            <StatTile
              icon={<Calendar className="w-5 h-5" style={{ color: 'var(--gold-mid)' }} />}
              value={`${goal}`}
              label="Duration"
            />
            <StatTile
              icon={<Target className="w-5 h-5" style={{ color: difficultyColor }} />}
              value={challenge.difficulty}
              label="Difficulty"
            />
            <StatTile
              icon={<TrendingUp className="w-5 h-5" style={{ color: 'var(--emerald)' }} />}
              value={`${progressCount}/${goal}`}
              label="Days Complete"
            />
          </div>

          {/* Progress bar */}
          <div className="mb-6">
            <div className="flex justify-between items-center mb-2">
              <span
                className="text-xs font-bold uppercase"
                style={{
                  color: 'var(--text-on-glass)',
                  opacity: 0.85,
                  letterSpacing: '0.16em',
                }}
              >
                Your Progress
              </span>
              <span
                className="text-sm font-semibold"
                style={{ color: 'var(--gold-light)' }}
              >
                {progressCount}/{goal} days · {Math.round((progressCount / goal) * 100)}%
              </span>
            </div>
            <div
              className="w-full rounded-full h-3 overflow-hidden"
              style={{
                background: 'rgba(0,0,0,0.25)',
                border: '1px solid var(--gold-mid)',
              }}
            >
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.min(100, (progressCount / goal) * 100)}%`,
                  background:
                    'linear-gradient(90deg, var(--emerald) 0%, var(--gold-mid) 100%)',
                  boxShadow: '0 0 8px rgba(212, 160, 23, 0.5)',
                }}
              />
            </div>
          </div>

          {/* Reward */}
          {challenge.reward && (
            <p
              className="text-xs italic text-center mb-6"
              style={{ color: 'var(--gold-mid)', opacity: 0.9 }}
            >
              Reward: {challenge.reward}
            </p>
          )}

          {/* Actions */}
          <div className="flex gap-3 flex-wrap">
            {isParticipating ? (
              <>
                <Button
                  variant="primary"
                  onClick={() => recordMut.mutate()}
                  disabled={recordMut.isPending}
                  className="flex-1 flex items-center justify-center gap-2"
                >
                  {recordMut.isPending ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      Saving…
                    </>
                  ) : (
                    <>
                      <Target className="w-4 h-4" />
                      {completedToday ? 'Undo Today' : 'Mark Today Done'}
                    </>
                  )}
                </Button>
                <Button
                  variant="secondary"
                  onClick={handleLeave}
                  disabled={leaveMut.isPending}
                  className="flex items-center gap-2"
                >
                  {leaveMut.isPending ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      Leaving…
                    </>
                  ) : (
                    'Leave Challenge'
                  )}
                </Button>
              </>
            ) : (
              <div
                className="flex-1 text-center text-sm italic py-3 rounded-xl"
                style={{
                  color: 'var(--text-on-glass)',
                  opacity: 0.7,
                  border: '1px dashed var(--gold-mid)',
                }}
              >
                You haven't joined this challenge yet — go back and tap "Join".
              </div>
            )}
            <Button
              variant="secondary"
              onClick={handleShare}
              className="flex items-center gap-2"
            >
              <Share2 className="w-4 h-4" />
              {shareCopied ? 'Copied!' : 'Share'}
            </Button>
          </div>

          {leaveMut.isError && (
            <p className="text-center text-xs mt-3" style={{ color: '#fca5a5' }}>
              Could not leave challenge. Please try again.
            </p>
          )}
        </div>
      </OrnateCard>

      {/* ============================ OVERVIEW ============================= */}
      <ManuscriptSection title="Challenge Overview" subtitle="Rules, benefits, and requirements">
        <OrnateCard variant="dark" corners="all" topBar className="!p-6">
          <div
            className="text-sm leading-relaxed mb-6"
            style={{
              color: 'var(--text-on-glass)',
              opacity: 0.85,
              fontFamily: 'Georgia, "Times New Roman", serif',
            }}
          >
            <p className="mb-3">
              This is a {goal}-day challenge designed to help you build a consistent habit of
              <span className="font-semibold" style={{ color: 'var(--gold-light)' }}>
                {' '}
                {challenge.name_en.toLowerCase()}
              </span>
              .
            </p>

            <h3
              className="text-base font-semibold mb-3 mt-5"
              style={{ color: 'var(--gold-light)' }}
            >
              Challenge Rules
            </h3>
            <ul className="space-y-2 mb-5 pl-1">
              <RuleRow text={`Engage with the practice at least once each day for ${goal} days.`} />
              <RuleRow text="Mark today's completion in the app to maintain your streak." />
              <RuleRow text="Use the grace day feature for missed days when available." />
              <RuleRow text="Complete within the timeframe to earn the reward." />
            </ul>

            <h3
              className="text-base font-semibold mb-3"
              style={{ color: 'var(--gold-light)' }}
            >
              Benefits
            </h3>
            <ul className="space-y-2 pl-1">
              <RuleRow text="Spiritual growth and a stronger daily routine." />
              <RuleRow text="Build a lasting habit, one day at a time." />
              <RuleRow text="Track your progress and celebrate milestones." />
              {challenge.reward && (
                <RuleRow text={`Earn ${challenge.reward} upon completion.`} />
              )}
            </ul>
          </div>

          <GoldDivider className="my-5" />

          <h3
            className="text-base font-semibold mb-4"
            style={{ color: 'var(--gold-light)' }}
          >
            Requirements
          </h3>
          <ul className="space-y-2">
            <RequirementRow text={`Daily commitment for ${goal} days.`} />
            <RequirementRow text="Log progress in the app." />
            <RequirementRow text="Maintain your streak." />
            <RequirementRow text="Complete within the timeframe." />
          </ul>
        </OrnateCard>
      </ManuscriptSection>

      {/* Footer ornament */}
      <div className="mt-8 flex items-center justify-center gap-2">
        <Star8 size={14} color="var(--gold-mid)" />
        <span
          className="text-[10px] uppercase font-bold"
          style={{
            color: 'var(--gold-mid)',
            opacity: 0.85,
            letterSpacing: '0.22em',
          }}
        >
          Journey Together
        </span>
        <Star8 size={14} color="var(--gold-mid)" />
      </div>
      </div>
    </div>
  )
}

/* ============================================================================
 *  Helper components
 * ========================================================================= */

const StatTile: React.FC<{ icon: React.ReactNode; value: string; label: string }> = ({
  icon,
  value,
  label,
}) => (
  <div
    className="rounded-xl px-4 py-3 text-center"
    style={{
      background: 'rgba(212, 160, 23, 0.08)',
      border: '1px solid var(--gold-mid)',
    }}
  >
    <div className="flex justify-center mb-1">{icon}</div>
    <div
      className="font-bold text-lg leading-none"
      style={{
        color: 'var(--text-on-glass)',
        fontFamily: 'Georgia, "Times New Roman", serif',
      }}
    >
      {value}
    </div>
    <div
      className="text-[10px] uppercase font-bold mt-1"
      style={{
        color: 'var(--text-on-glass)',
        opacity: 0.7,
        letterSpacing: '0.18em',
      }}
    >
      {label}
    </div>
  </div>
)

const RuleRow: React.FC<{ text: string }> = ({ text }) => (
  <li className="flex items-start gap-2">
    <span
      className="mt-2 inline-block w-1.5 h-1.5 rounded-full flex-shrink-0"
      style={{ background: 'var(--gold-mid)' }}
    />
    <span style={{ color: 'var(--text-on-glass)', opacity: 0.85 }}>{text}</span>
  </li>
)

const RequirementRow: React.FC<{ text: string }> = ({ text }) => (
  <li
    className="flex items-center gap-3 p-2 rounded-lg"
    style={{
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(212, 160, 23, 0.25)',
    }}
  >
    <input
      type="checkbox"
      className="w-4 h-4 rounded"
      readOnly
      style={{ accentColor: 'var(--gold-mid)' }}
    />
    <span style={{ color: 'var(--text-on-glass)', opacity: 0.85 }}>{text}</span>
  </li>
)

export default ChallengeDetail