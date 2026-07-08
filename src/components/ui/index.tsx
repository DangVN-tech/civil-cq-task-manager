import { useEffect, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { ChevronDown, SlidersHorizontal, X } from 'lucide-react'
import { cn } from '../../lib/utils'

/* ============ Button ============ */
type BtnVariant = 'primary' | 'secondary' | 'danger' | 'ghost'
export function Button({
  variant = 'secondary',
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant }) {
  const styles: Record<BtnVariant, string> = {
    primary: 'bg-brand-500 text-white hover:bg-brand-600 border-transparent shadow-md shadow-indigo-100',
    secondary: 'bg-white text-slate-700 hover:bg-slate-50 border-slate-200',
    danger: 'bg-white text-rose-600 hover:bg-rose-50 border-rose-200',
    ghost: 'bg-transparent text-slate-600 hover:bg-slate-100 border-transparent',
  }
  return (
    <button
      className={cn(
        'inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-sm font-bold transition-all',
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
  'w-full rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-sm outline-none transition-all focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10'

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
      <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-400">
        {label} {required && <span className="text-rose-500">*</span>}
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onMouseDown={onClose}>
      <div
        className={cn('w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl', width)}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-4 py-3">
          <h2 className="text-sm font-extrabold tracking-tight text-slate-800">{title}</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Đóng">
            <X size={16} />
          </button>
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
      <div className="text-sm text-slate-700">{message}</div>
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
    <div className={cn('h-2 w-full overflow-hidden rounded-full bg-slate-100', className)}>
      <div
        className={cn('h-full rounded-full transition-all duration-500',
          value >= 100 ? 'bg-emerald-500' : 'bg-brand-500')}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  )
}

/* ============ Progress slider (thanh trượt + nút nhanh) ============ */
export function ProgressSlider({
  value,
  onChange,
  disabled,
}: {
  value: number
  onChange: (v: number) => void
  disabled?: boolean
}) {
  const quick = [0, 25, 50, 75, 100]
  return (
    <div className={cn('space-y-2.5', disabled && 'pointer-events-none opacity-60')}>
      <input
        type="range" min={0} max={100} step={5} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-slate-100 accent-brand-500"
      />
      <div className="grid grid-cols-5 gap-1">
        {quick.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => onChange(q)}
            className={cn(
              'rounded-lg border py-1 text-[10px] font-bold transition-all',
              q === 100
                ? 'border-emerald-100 bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                : 'border-slate-100 bg-slate-50 text-slate-500 hover:bg-slate-100',
            )}
          >
            {q}%
          </button>
        ))}
      </div>
    </div>
  )
}

/* ============ Card (thẻ trắng bo tròn theo mockup) ============ */
export const cardCls = 'rounded-2xl border border-slate-200 bg-white shadow-sm'

/* ============ Badge số cập nhật chưa đọc (chấm tròn đỏ) ============ */
export function UnreadBadge({ count, className }: { count: number; className?: string }) {
  if (count <= 0) return null
  return (
    <span
      className={cn(
        'inline-flex min-w-[16px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-extrabold leading-4 text-white',
        className,
      )}
      title={`${count} cập nhật chưa đọc`}
    >
      {count > 99 ? '99+' : count}
    </span>
  )
}

/* ============ Spinner / empty state ============ */
export function Loading({ label = 'Đang tải...' }: { label?: string }) {
  return <div className="p-6 text-center text-sm text-slate-400">{label}</div>
}

export function Empty({ label }: { label: string }) {
  return <div className="p-8 text-center text-sm text-slate-400">{label}</div>
}

/* ============ Bộ lọc nâng cao dạng accordion (thu gọn mặc định) ============ */
export function FilterAccordion({
  activeCount,
  onReset,
  children,
}: {
  activeCount: number
  onReset?: () => void
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border-b border-slate-200/80 bg-slate-50 px-3.5 py-2.5">
      <button onClick={() => setOpen(!open)} className="group flex w-full items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-5 w-5 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
            <SlidersHorizontal size={11} />
          </span>
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-700 group-hover:text-brand-600">
            Bộ lọc nâng cao
          </span>
          {activeCount > 0 && (
            <span className="rounded-full bg-brand-100 px-1.5 py-0.5 text-[10px] font-bold text-brand-600">{activeCount}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {activeCount > 0 && onReset && (
            <span
              role="button"
              onClick={(e) => { e.stopPropagation(); onReset() }}
              className="text-[10px] font-bold text-brand-600 hover:text-brand-800"
            >
              Xóa lọc
            </span>
          )}
          <ChevronDown size={14} className={cn('text-slate-400 transition-transform duration-200', open && 'rotate-180')} />
        </div>
      </button>
      {open && <div className="mt-3 space-y-2.5 border-t border-slate-100 pt-3">{children}</div>}
    </div>
  )
}
