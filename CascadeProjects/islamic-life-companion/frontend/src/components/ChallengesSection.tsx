interface ChallengesSectionProps {
  className?: string
  onJoinChallenge?: (challengeId: string, challengeName: string) => void
  joinedChallenges?: Map<string, any>
}

export const ChallengesSection = ({ className = '', onJoinChallenge, joinedChallenges }: ChallengesSectionProps) => {
  // Sample challenges data
  const availableChallenges = [
    { id: '1', name_en: 'Daily Quran Reading', description: 'Read Quran daily for 30 consecutive days' },
    { id: '2', name_en: 'Prayer Consistency', description: 'Pray all 5 prayers on time for 30 days' },
    { id: '3', name_en: 'Dhikr Practice', description: 'Daily dhikr routine for 30 days' },
    { id: '4', name_en: 'Morning Routine', description: 'Complete morning routine for 30 days' },
    { id: '5', name_en: 'Character Development', description: 'Work on character traits for 30 days' },
    { id: '6', name_en: 'Health & Wellness', description: 'Maintain health habits for 30 days' },
  ]

  return (
    <div className={`p-6 bg-white rounded-3xl shadow-soft border border-sage-200 ${className}`}>
      <h2 className="text-2xl font-bold text-sage-800 mb-4">Available Challenges</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {availableChallenges.map((challenge) => {
          const isJoined = joinedChallenges?.has(challenge.id)
          return (
            <div key={challenge.id} className={`p-4 rounded-2xl border-2 transition-all ${
              isJoined 
                ? 'bg-mint-100 border-mint-500 shadow-soft' 
                : 'bg-sage-50 border-sage-200 hover:border-sage-300'
            }`}>
              <h3 className="font-bold text-lg text-sage-800">{challenge.name_en}</h3>
              <p className="text-sm text-sage-600 mt-1">{challenge.description}</p>
              {!isJoined && onJoinChallenge && (
                <button
                  onClick={() => onJoinChallenge(challenge.id, challenge.name_en)}
                  className="mt-3 w-full bg-sage-500 hover:bg-sage-600 text-white px-4 py-2 rounded-xl transition-colors font-semibold"
                >
                  Join Challenge
                </button>
              )}
              {isJoined && (
                <div className="mt-3 text-sm text-mint-700 font-semibold">
                  ✓ Joined
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
