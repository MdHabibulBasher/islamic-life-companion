import { X, AlertCircle } from 'lucide-react'

interface ModalProps {
  isOpen: boolean
  title: string
  children: React.ReactNode
  onClose: () => void
  size?: 'sm' | 'md' | 'lg' | 'xl'
  showCloseButton?: boolean
}

export const Modal = ({
  isOpen,
  title,
  children,
  onClose,
  size = 'md',
  showCloseButton = true,
}: ModalProps) => {
  if (!isOpen) return null

  const sizeClasses = {
    sm: 'w-full max-w-sm',
    md: 'w-full max-w-md',
    lg: 'w-full max-w-lg',
    xl: 'w-full max-w-2xl',
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 py-6 text-center sm:p-0">
        {/* Background overlay */}
        <div
          className="fixed inset-0 transition-opacity"
          style={{ background: 'rgba(8, 24, 18, 0.65)', backdropFilter: 'blur(4px)' }}
          onClick={onClose}
        />

        {/* Modal */}
        <div
          className={`relative inline-block align-bottom rounded-2xl text-left overflow-hidden shadow-2xl transform transition-all sm:align-middle ${sizeClasses[size]} my-4 max-h-[90vh] flex flex-col`}
          style={{
            background:
              'linear-gradient(180deg, var(--manuscript-cream) 0%, var(--manuscript-cream-2) 100%)',
            border: '1px solid var(--gold-mid)',
            boxShadow:
              '0 24px 64px -16px rgba(0,0,0,0.55), 0 0 0 1px var(--gold-deep) inset',
          }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-5 py-3 shrink-0"
            style={{
              background:
                'linear-gradient(135deg, var(--gold-mid) 0%, var(--gold-light) 100%)',
              borderBottom: '1px solid var(--gold-deep)',
            }}
          >
            <h3
              className="text-base font-bold"
              style={{
                color: 'var(--emerald-deep)',
                fontFamily: 'Georgia, "Times New Roman", serif',
                letterSpacing: '0.02em',
              }}
            >
              {title}
            </h3>
            {showCloseButton && (
              <button
                onClick={onClose}
                className="transition-colors"
                style={{ color: 'var(--emerald-deep)' }}
                aria-label="Close"
              >
                <X size={20} />
              </button>
            )}
          </div>

          {/* Content */}
          <div
            className="px-5 py-3 overflow-y-auto"
            style={{ color: 'var(--emerald-deep)' }}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}

interface ConfirmModalProps {
  isOpen: boolean
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  isDangerous?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export const ConfirmModal = ({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  isDangerous = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) => {
  return (
    <Modal isOpen={isOpen} title={title} onClose={onCancel} size="sm" showCloseButton={false}>
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <AlertCircle className={`flex-shrink-0 ${isDangerous ? 'text-red-500' : 'text-blue-500'}`} size={24} />
          <p className="text-gray-700 dark:text-gray-300">{message}</p>
        </div>
        
        <div className="flex gap-3 justify-end pt-4">
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 rounded-lg text-white transition-colors ${
              isDangerous
                ? 'bg-red-500 hover:bg-red-600'
                : 'bg-blue-500 hover:bg-blue-600'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </Modal>
  )
}
