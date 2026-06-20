import { AlertCircle, CheckCircle, Info, AlertTriangle, X } from 'lucide-react'
import { useEffect, useState } from 'react'

export type ToastType = 'success' | 'error' | 'info' | 'warning'

interface Toast {
  id: string
  type: ToastType
  message: string
  duration?: number
}

interface ToastProps {
  toast: Toast
  onClose: (id: string) => void
}

const ToastItem = ({ toast, onClose }: ToastProps) => {
  useEffect(() => {
    if (toast.duration) {
      const timer = setTimeout(() => onClose(toast.id), toast.duration)
      return () => clearTimeout(timer)
    }
  }, [toast.duration, toast.id, onClose])

  const icons = {
    success: <CheckCircle className="w-5 h-5 text-green-500" />,
    error: <AlertCircle className="w-5 h-5 text-red-500" />,
    info: <Info className="w-5 h-5 text-blue-500" />,
    warning: <AlertTriangle className="w-5 h-5 text-yellow-500" />,
  }

  const bgColors = {
    success: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800',
    error: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',
    info: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
    warning: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800',
  }

  const textColors = {
    success: 'text-green-800 dark:text-green-200',
    error: 'text-red-800 dark:text-red-200',
    info: 'text-blue-800 dark:text-blue-200',
    warning: 'text-yellow-800 dark:text-yellow-200',
  }

  return (
    <div
      className={`flex items-center gap-3 p-4 rounded-lg border ${bgColors[toast.type]} ${textColors[toast.type]} shadow-lg animate-slide-in`}
      role="alert"
    >
      {icons[toast.type]}
      <span className="flex-1">{toast.message}</span>
      <button
        onClick={() => onClose(toast.id)}
        className="opacity-70 hover:opacity-100 transition-opacity"
      >
        <X size={18} />
      </button>
    </div>
  )
}

interface ToastContainerProps {
  toasts: Toast[]
  onClose: (id: string) => void
}

export const ToastContainer = ({ toasts, onClose }: ToastContainerProps) => {
  return (
    <div className="fixed bottom-4 right-4 space-y-2 z-50 max-w-md">
      {toasts.map(toast => (
        <ToastItem key={toast.id} toast={toast} onClose={onClose} />
      ))}
    </div>
  )
}

export const useToast = () => {
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = (message: string, type: ToastType = 'info', duration: number = 3000) => {
    const id = Math.random().toString(36).substr(2, 9)
    const newToast: Toast = { id, message, type, duration }
    setToasts(prev => [...prev, newToast])
  }

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id))
  }

  return {
    toasts,
    addToast,
    removeToast,
    success: (message: string) => addToast(message, 'success'),
    error: (message: string) => addToast(message, 'error', 4000),
    info: (message: string) => addToast(message, 'info'),
    warning: (message: string) => addToast(message, 'warning'),
  }
}
