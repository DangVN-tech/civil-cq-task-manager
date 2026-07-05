import { useEffect, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { cn } from '../../lib/utils'

/* ============ Button ============ */
type BtnVariant = 'primary' | 'secondary' | 'danger' | 'ghost'
export function Button({
  variant = 'secondary',
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant }) {
  const styles: Record<BtnVariant, string> = {
    primary: 'bg-brand-500 text-white hover:bg-brand-600 border-brand-600',
    secondary: 'bg-white text-gray-800 hover:bg-gray-100 border-gray-300',
    danger: 'bg-red-600 text-white hover:bg-red-700 border-red-700',
    ghost: 'bg-transparent text-gray-700 hover:bg-gray-200 border-transparent',
  }
  return (
    <button
      className={cn(
        'inline-flex items-center gap-1.5 border px-3 py-1.5 text-sm font-medium',
        'disabled:cursor-not-allowed disabled:opacity-50',
        styles[variant],
        className,
      )}
      {...props}
    />
  )
}

/* ============ Input / Textarea / Select ============ */
const fieldCls =
  'w-full border border-gray-300 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-brand-500'

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(fieldCls, className)} {...props} />
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(fieldCls, 'min-h-24', className)} {...props} />
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(fieldCls, className)} {...props}>
      {children}
    </select>
  )
}

export function Field({ label, children, required }: { label: string; children: ReactNode; required?: boolean }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-gray-600">
        {label} {required && <span className="text-red-600">*</span>}
      </span>
      {children}
    </label>
  )
}

/* ============ Dialog ============ */
export function Dialog({
  open,
  onClose,
  title,
  children,
  width = 'max-w-lg',
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  width?: string
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onMouseDown={onClose}>
      <div
        className={cn('w-full border border-gray-400 bg-white shadow-xl', width)}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-4 py-2.5">
          <h2 className="text-sm font-semibold">{title}</h2>
          <button onClick={onClose} className="px-1 text-gray-500 hover:text-gray-800" aria-label="Đóng">✕</button>
        </div>
        <div className="max-h-[80vh] overflow-y-auto p-4">{children}</div>
      </div>
    </div>
  )
}

/* ============ Confirm dialog ============ */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Xác nhận',
  danger,
}: {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: ReactNode
  confirmLabel?: string
  danger?: boolean
}) {
  return (
    <Dialog open={open} onClose={onClose} title={title} width="max-w-sm">
      <div className="text-sm text-gray-700">{message}</div>
      <div className="mt-4 flex justify-end gap-2">
        <Button onClick={onClose}>Hủy</Button>
        <Button variant={danger ? 'danger' : 'primary'} onClick={() => { onConfirm(); onClose() }}>
          {confirmLabel}
        </Button>
      </div>
    </Dialog>
  )
}

/* ============ Progress bar ============ */
export function ProgressBar({ value, className }: { value: number; className?: string }) {
  return (
    <div className={cn('h-2 w-full bg-gray-200', className)}>
      <div
        className={cn('h-full', value >= 100 ? 'bg-green-600' : 'bg-brand-500')}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  )
}

/* ============ Spinner / empty state ============ */
export function Loading({ label = 'Đang tải...' }: { label?: string }) {
  return <div className="p-6 text-center text-sm text-gray-500">{label}</div>
}

export function Empty({ label }: { label: string }) {
  return <div className="p-8 text-center text-sm text-gray-400">{label}</div>
}
