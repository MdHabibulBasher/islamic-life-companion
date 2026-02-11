import React, { useState } from 'react';
import { ChevronLeft, Trophy, Users, Target, Calendar, TrendingUp, Share2, MessageCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/Form';
// import { LoadingSpinner } from '../components';

interface ChallengeParticipant {
  id: string;
  name: string;
  avatar: string;
  progress: number;
  rank: number;
  score: number;
}

export const ChallengeDetail: React.FC = () => {
  const navigate = useNavigate();
  const [isParticipating, setIsParticipating] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'leaderboard' | 'discussion'>('overview');

  // Mock challenge data
  const challenge = {
    id: '1',
    title: 'Complete 30 Days of Quran Reading',
    description:
      'Join this challenge to read at least one page of Quran every day for 30 consecutive days. Build a strong habit of Quranic learning.',
    category: 'Quran Reading',
    startDate: '2024-02-01',
    endDate: '2024-02-29',
    participants: 234,
    image: 'https://images.unsplash.com/photo-1507842217343-583f20270319?w=500&h=300&fit=crop',
    progress: 15,
    goal: 30,
    difficulty: 'Medium',
    reward: '500 Points',
    description_long: `This is a comprehensive 30-day challenge designed to help you establish a consistent Quran reading habit. 
    Reading the Quran daily is one of the most beneficial practices in Islam, bringing spiritual growth and peace.
    
    Challenge Rules:
    - Read at least one page (or 5 minutes) of Quran each day
    - Log your reading in the app
    - Maintain a consecutive streak
    - Upon completion, earn special badges and rewards
    
    Benefits:
    - Spiritual growth and connection to the Quran
    - Build a lasting daily habit
    - Connect with other Muslims doing the same challenge
    - Earn achievements and rewards
    - Track your progress and celebrate milestones`,
    requirements: [
      'Daily Quran reading (minimum 1 page)',
      'Log reading in app',
      'Maintain streak',
      'Complete within timeframe',
    ],
  };

  const participants: ChallengeParticipant[] = [
    {
      id: '1',
      name: 'Ahmed Hassan',
      avatar: '👨‍🎓',
      progress: 30,
      rank: 1,
      score: 1500,
    },
    {
      id: '2',
      name: 'Fatima Mohamed',
      avatar: '👩‍💼',
      progress: 29,
      rank: 2,
      score: 1450,
    },
    {
      id: '3',
      name: 'Ibrahim Khan',
      avatar: '👨‍💻',
      progress: 28,
      rank: 3,
      score: 1400,
    },
    {
      id: '4',
      name: 'Aisha Ali',
      avatar: '👩‍🎨',
      progress: 27,
      rank: 4,
      score: 1350,
    },
    {
      id: '5',
      name: 'You',
      avatar: '👤',
      progress: 15,
      rank: 45,
      score: 750,
    },
  ];

  const discussions = [
    {
      id: '1',
      author: 'Ahmed Hassan',
      avatar: '👨‍🎓',
      message: 'Day 30 completed! Alhamdulillah, this challenge has changed my relationship with the Quran.',
      timestamp: '2 hours ago',
      likes: 24,
    },
    {
      id: '2',
      author: 'Fatima Mohamed',
      avatar: '👩‍💼',
      message: 'Just finished day 29. So close to the finish line! Who else is on the home stretch?',
      timestamp: '4 hours ago',
      likes: 18,
    },
    {
      id: '3',
      author: 'Ibrahim Khan',
      avatar: '👨‍💻',
      message: 'The consistency from this challenge is amazing. I recommend everyone try it!',
      timestamp: '6 hours ago',
      likes: 31,
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      {/* Header with Background Image */}
      <div
        className="h-64 bg-cover bg-center relative"
        style={{ backgroundImage: `url(${challenge.image})` }}
      >
        <div className="absolute inset-0 bg-black/50" />
        <button
          onClick={() => navigate(-1)}
          className="absolute top-4 left-4 p-2 rounded-lg bg-black/50 hover:bg-black/70 transition"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
      </div>

      <div className="max-w-4xl mx-auto px-4 -mt-16 relative z-10">
        {/* Challenge Header */}
        <div className="bg-slate-800 rounded-lg p-6 mb-6 shadow-xl">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <div className="text-emerald-400 text-sm font-semibold mb-2">{challenge.category}</div>
              <h1 className="text-3xl font-bold mb-2">{challenge.title}</h1>
              <p className="text-slate-300 text-sm">{challenge.description}</p>
            </div>
            <div className="text-right">
              <div className="text-4xl font-bold text-emerald-400 mb-2">{challenge.reward}</div>
              <div className="text-sm text-slate-400">Completion Prize</div>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="bg-slate-700 rounded p-3 text-center">
              <Users className="w-5 h-5 mx-auto mb-2 text-emerald-400" />
              <div className="font-bold">{challenge.participants}</div>
              <div className="text-xs text-slate-400">Participants</div>
            </div>
            <div className="bg-slate-700 rounded p-3 text-center">
              <Calendar className="w-5 h-5 mx-auto mb-2 text-blue-400" />
              <div className="font-bold">{challenge.goal} Days</div>
              <div className="text-xs text-slate-400">Duration</div>
            </div>
            <div className="bg-slate-700 rounded p-3 text-center">
              <Target className="w-5 h-5 mx-auto mb-2 text-yellow-400" />
              <div className="font-bold">{challenge.difficulty}</div>
              <div className="text-xs text-slate-400">Difficulty</div>
            </div>
            <div className="bg-slate-700 rounded p-3 text-center">
              <TrendingUp className="w-5 h-5 mx-auto mb-2 text-purple-400" />
              <div className="font-bold">{challenge.progress}/{challenge.goal}</div>
              <div className="text-xs text-slate-400">Your Progress</div>
            </div>
          </div>

          {/* Your Progress */}
          <div className="mb-6">
            <div className="flex justify-between items-center mb-2">
              <span className="font-semibold">Your Progress</span>
              <span className="text-sm text-slate-400">
                {challenge.progress}/{challenge.goal} days
              </span>
            </div>
            <div className="w-full bg-slate-700 rounded-full h-4 overflow-hidden">
              <div
                className="bg-gradient-to-r from-emerald-400 to-emerald-500 h-full rounded-full transition-all"
                style={{ width: `${(challenge.progress / challenge.goal) * 100}%` }}
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            {isParticipating ? (
              <>
                <Button variant="primary" className="flex-1 flex items-center justify-center gap-2">
                  <Target className="w-4 h-4" />
                  Record Progress
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => setIsParticipating(false)}
                  className="flex items-center gap-2"
                >
                  Leave Challenge
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="primary"
                  onClick={() => setIsParticipating(true)}
                  className="flex-1 flex items-center justify-center gap-2"
                >
                  <Trophy className="w-4 h-4" />
                  Join Challenge
                </Button>
              </>
            )}
            <Button variant="secondary" className="flex items-center gap-2">
              <Share2 className="w-4 h-4" />
              Share
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-slate-700">
          {(['overview', 'leaderboard', 'discussion'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-3 font-semibold border-b-2 transition ${
                activeTab === tab
                  ? 'border-emerald-500 text-emerald-400'
                  : 'border-transparent text-slate-400 hover:text-slate-300'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <div className="bg-slate-800 rounded-lg p-6 mb-8 shadow-xl">
            <h2 className="text-xl font-bold mb-4">Challenge Overview</h2>
            <div className="prose prose-invert max-w-none text-slate-300 whitespace-pre-wrap mb-6">
              {challenge.description_long}
            </div>

            <h3 className="text-lg font-bold mb-4">Requirements</h3>
            <ul className="space-y-2">
              {challenge.requirements.map((req, idx) => (
                <li key={idx} className="flex items-center gap-3 text-slate-300">
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded accent-emerald-500"
                    readOnly
                  />
                  {req}
                </li>
              ))}
            </ul>
          </div>
        )}

        {activeTab === 'leaderboard' && (
          <div className="bg-slate-800 rounded-lg p-6 mb-8 shadow-xl">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
              <Trophy className="w-5 h-5 text-yellow-400" />
              Leaderboard
            </h2>

            <div className="space-y-3">
              {participants.map((participant) => (
                <div
                  key={participant.id}
                  className="p-4 bg-slate-700 rounded-lg flex items-center justify-between"
                >
                  <div className="flex items-center gap-4 flex-1">
                    <div className="text-2xl font-bold text-slate-500 w-8">{participant.rank}</div>
                    <div className="text-2xl">{participant.avatar}</div>
                    <div className="flex-1">
                      <div className="font-semibold">{participant.name}</div>
                      <div className="text-sm text-slate-400">
                        {participant.progress}/{challenge.goal} days completed
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-emerald-400">{participant.score} pts</div>
                    <div className="text-sm text-slate-400">
                      {Math.round((participant.progress / challenge.goal) * 100)}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'discussion' && (
          <div className="bg-slate-800 rounded-lg p-6 mb-8 shadow-xl">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-blue-400" />
              Community Discussion
            </h2>

            {/* New Message Form */}
            {isParticipating && (
              <div className="mb-6 p-4 bg-slate-700 rounded-lg">
                <textarea
                  placeholder="Share your progress or encourage others..."
                  className="w-full bg-slate-600 rounded p-3 text-white placeholder-slate-400 resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500 mb-3"
                  rows={3}
                />
                <Button variant="primary">Post Message</Button>
              </div>
            )}

            {/* Messages */}
            <div className="space-y-4">
              {discussions.map((msg) => (
                <div key={msg.id} className="p-4 bg-slate-700 rounded-lg">
                  <div className="flex items-start gap-3 mb-2">
                    <div className="text-2xl">{msg.avatar}</div>
                    <div className="flex-1">
                      <div className="font-semibold">{msg.author}</div>
                      <div className="text-xs text-slate-400">{msg.timestamp}</div>
                    </div>
                  </div>
                  <p className="text-slate-300 mb-3">{msg.message}</p>
                  <button className="text-sm text-slate-400 hover:text-emerald-400 transition">
                    ❤️ {msg.likes} likes
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
