import { PRIORITY_LABEL, type Priority } from '../../types'
import { cn } from '../../lib/utils'

/* Chỉ Khẩn (đỏ) và Gấp (cam) có biển hiệu; Thường không cần */
const BADGE: Record<Priority, string | null> = {
  khan: 'bg-rose-50 text-rose-700',
  gap: 'bg-amber-50 text-amber-700',
  thuong: null,
}

export const PRIORITY_STRIP: Record<Priority, string> = {
  khan: 'bg-rose-500',
  gap: 'bg-amber-500',
  thuong: 'bg-slate-300',
}

export default function PriorityBadge({ priority, className }: { priority: Priority; className?: string }) {
  const style = BADGE[priority]
  if (!style) return null
  return (
    <span className={cn('inline-block rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider', style, className)}>
      {PRIORITY_LABEL[priority]}
    </span>
  )
}
