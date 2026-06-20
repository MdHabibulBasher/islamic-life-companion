import { Loader } from 'lucide-react'

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  text?: string
  fullScreen?: boolean
}

export const LoadingSpinner = ({
  size = 'md',
  text,
  fullScreen = false,
}: LoadingSpinnerProps) => {
  const sizeClasses = {
    sm: 'w-6 h-6',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
  }

  if (fullScreen) {
    return (
      <div className="fixed inset-0 bg-white dark:bg-gray-900 bg-opacity-90 dark:bg-opacity-90 flex items-center justify-center z-50">
        <div className="text-center">
          <Loader className={`${sizeClasses[size]} animate-spin text-blue-500 mx-auto mb-4`} />
          {text && <p className="text-gray-600 dark:text-gray-400">{text}</p>}
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center gap-3">
      <Loader className={`${sizeClasses[size]} animate-spin text-blue-500`} />
      {text && <span className="text-gray-600 dark:text-gray-400">{text}</span>}
    </div>
  )
}

interface SkeletonProps {
  className?: string
  count?: number
}

export const Skeleton = ({ className = 'h-4 bg-gray-200 rounded', count = 1 }: SkeletonProps) => {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={`${className} animate-pulse mb-2`}
        />
      ))}
    </>
  )
}
