import { useState } from 'react'
import { Plus, Minus } from 'lucide-react'

interface HabitCounterProps {
  initialValue?: number
  targetValue?: number
  unit?: string
  onUpdate?: (value: number) => void
  onComplete?: (count: number) => void
  disabled?: boolean
}

export const HabitCounter = ({
  initialValue = 0,
  targetValue,
  unit = 'times',
  onUpdate,
  onComplete,
  disabled = false,
}: HabitCounterProps) => {
  const [value, setValue] = useState(initialValue)

  const increment = () => {
    const newValue = value + 1
    setValue(newValue)
    onUpdate?.(newValue)
    
    // Check if target reached
    if (targetValue && newValue >= targetValue) {
      onComplete?.(newValue)
    }
  }

  const decrement = () => {
    const newValue = Math.max(0, value - 1)
    setValue(newValue)
    onUpdate?.(newValue)
  }

  return (
    <div className="flex flex-col items-center justify-center gap-4 p-4 bg-white dark:bg-gray-800 rounded-lg shadow">
      <div className="flex items-center justify-center gap-4">
        <button
          onClick={decrement}
          disabled={disabled || value === 0}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg disabled:opacity-50"
        >
          <Minus size={20} />
        </button>
        
        <div className="text-center">
          <div className="text-4xl font-bold text-gray-900 dark:text-white">{value}</div>
          {targetValue && (
            <div className="text-sm text-gray-500 dark:text-gray-400">
              {value} / {targetValue} {unit}
            </div>
          )}
          {!targetValue && (
            <div className="text-sm text-gray-500 dark:text-gray-400">{unit}</div>
          )}
        </div>

        <button
          onClick={increment}
          disabled={disabled}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg disabled:opacity-50"
        >
          <Plus size={20} />
        </button>
      </div>
      
      {targetValue && value >= targetValue && (
        <button
          onClick={() => onComplete?.(value)}
          className="mt-4 px-6 py-2 bg-green-500 text-white rounded-lg font-semibold hover:bg-green-600 transition-colors"
        >
          Complete
        </button>
      )}
    </div>
  )
}
