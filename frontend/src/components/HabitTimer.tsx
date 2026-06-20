import { useState, useEffect, useRef } from 'react'
import { Clock, Play, Pause, RotateCcw } from 'lucide-react'

interface HabitTimerProps {
  targetValue: number
  unit: string
  onComplete?: (seconds: number) => void
  initialSeconds?: number
}

export const HabitTimer: React.FC<HabitTimerProps> = ({ 
  targetValue, 
  unit, 
  onComplete, 
  initialSeconds = 0 
}) => {
  const [seconds, setSeconds] = useState(initialSeconds)
  const [isRunning, setIsRunning] = useState(false)
  const intervalRef = useRef<number | null>(null)

  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        setSeconds(prev => {
          const newSeconds = prev + 1
          
          // Check if target reached
          if (unit === 'minutes' && newSeconds >= targetValue * 60) {
            setIsRunning(false)
            onComplete?.(newSeconds)
            return newSeconds
          }
          if (unit === 'seconds' && newSeconds >= targetValue) {
            setIsRunning(false)
            onComplete?.(newSeconds)
            return newSeconds
          }
          
          return newSeconds
        })
      }, 1000)
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [isRunning, targetValue, unit, onComplete])

  const formatTime = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const secs = totalSeconds % 60
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`
  }

  const getProgress = () => {
    const targetSeconds = unit === 'minutes' ? targetValue * 60 : targetValue
    return Math.min((seconds / targetSeconds) * 100, 100)
  }

  const handleStart = () => setIsRunning(true)
  const handlePause = () => setIsRunning(false)
  const handleReset = () => {
    setIsRunning(false)
    setSeconds(0)
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg">
      <div className="flex items-center justify-center mb-4">
        <Clock className="w-8 h-8 text-blue-500" />
      </div>
      
      <div className="text-center mb-6">
        <div className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
          {formatTime(seconds)}
        </div>
        <div className="text-sm text-gray-600 dark:text-gray-400">
          Target: {targetValue} {unit}
        </div>
      </div>

      <div className="mb-6">
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
          <div 
            className="bg-gradient-to-r from-blue-500 to-cyan-500 h-3 rounded-full transition-all duration-300"
            style={{ width: `${getProgress()}%` }}
          />
        </div>
        <div className="text-center text-sm text-gray-600 dark:text-gray-400 mt-2">
          {Math.round(getProgress())}% Complete
        </div>
      </div>

      <div className="flex gap-3">
        {!isRunning ? (
          <button
            onClick={handleStart}
            className="flex-1 bg-gradient-to-r from-blue-500 to-cyan-500 text-white px-4 py-3 rounded-xl font-semibold shadow hover:shadow-lg transition-all duration-300 flex items-center justify-center gap-2"
          >
            <Play className="w-5 h-5" />
            Start
          </button>
        ) : (
          <button
            onClick={handlePause}
            className="flex-1 bg-gradient-to-r from-orange-500 to-red-500 text-white px-4 py-3 rounded-xl font-semibold shadow hover:shadow-lg transition-all duration-300 flex items-center justify-center gap-2"
          >
            <Pause className="w-5 h-5" />
            Pause
          </button>
        )}
        
        <button
          onClick={handleReset}
          className="px-4 py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-semibold hover:bg-gray-300 dark:hover:bg-gray-600 transition-all duration-300"
        >
          <RotateCcw className="w-5 h-5" />
        </button>
      </div>
    </div>
  )
}
