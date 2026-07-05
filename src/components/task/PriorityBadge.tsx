import { PRIORITY_LABEL, type Priority } from '../../types'
import { cn } from '../../lib/utils'

/* Khẩn = đỏ, Gấp = cam, Thường = xám nhạt */
const BADGE: Record<Priority, string> = {
  khan: 'bg-red-600 text-white',
  gap: 'bg-orange-500 text-white',
  thuong: 'bg-gray-200 text-gray-600',
}

export const PRIORITY_STRIP: Record<Priority, string> = {
  khan: 'bg-red-600',
  gap: 'bg-orange-500',
  thuong: 'bg-gray-300',
}

export default function PriorityBadge({ priority, className }: { priority: Priority; className?: string }) {
  return (
    <span className={cn('inline-block px-1.5 py-0.5 text-[11px] font-semibold', BADGE[priority], className)}>
      {PRIORITY_LABEL[priority]}
    </span>
  )
}
