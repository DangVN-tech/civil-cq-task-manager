import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCurrentUser } from '../../context/AuthContext'
import { useNotificationActions, useNotifications } from '../../hooks/useNotifications'
import { fmtTime } from '../../lib/utils'
import type { Notification } from '../../types'
import { Button } from '../ui'

const MAX_VISIBLE = 5

/** Thông báo desktop kiểu Outlook: xếp chồng góc phải dưới màn hình. */
export default function ToastStack() {
  const user = useCurrentUser()
  const { data } = useNotifications(user.id)
  const { markRead, snooze } = useNotificationActions(user.id)
  // tick mỗi 30s để thông báo hết hạn snooze tự hiện lại
  const [, setTick] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 30_000)
    return () => clearInterval(t)
  }, [])

  const now = Date.now()
  const visible = (data ?? [])
    .filter((n) => !n.snoozed_until || new Date(n.snoozed_until).getTime() <= now)
    .slice(0, MAX_VISIBLE)

  // Bắn thông báo hệ điều hành khi tab đang chạy nền (không cần mở/focus app để thấy),
  // giống Outlook desktop. Chỉ bắn 1 lần/thông báo trong phiên, và chỉ khi tab không active.
  const notifiedRef = useRef<Set<number>>(new Set())
  useEffect(() => {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
    if (!document.hidden) return
    for (const n of visible) {
      if (notifiedRef.current.has(n.id)) continue
      notifiedRef.current.add(n.id)
      const osNotif = new Notification('Civil&CQ Task Manager', {
        body: n.message,
        icon: '/favicon.svg',
        tag: `ccq-${n.id}`,
      })
      osNotif.onclick = () => {
        window.focus()
        if (n.task_id) window.location.href = `/dang-thuc-hien?task=${n.task_id}`
      }
    }
  }, [visible])

  if (visible.length === 0) return null

  return (
    <div className="fixed bottom-3 right-3 z-40 flex w-80 flex-col gap-2">
      {visible.map((n) => (
        <Toast key={n.id} n={n}
          onClose={() => markRead.mutate(n.id)}
          onSnooze={(mins) => snooze.mutate({ id: n.id, minutes: mins })}
        />
      ))}
    </div>
  )
}

function Toast({ n, onClose, onSnooze }: {
  n: Notification
  onClose: () => void
  onSnooze: (minutes: number) => void
}) {
  const navigate = useNavigate()
  const [minutes, setMinutes] = useState(15) // mặc định 15 phút, người dùng sửa được

  const open = () => {
    if (n.task_id) {
      navigate(`/dang-thuc-hien?task=${n.task_id}`)
      onClose()
    }
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
      <div className="flex items-center justify-between bg-brand-500 px-3 py-2">
        <span className="text-xs font-semibold text-white">Civil&CQ Task Manager</span>
        <button onClick={onClose} className="text-xs text-white/90 hover:text-white" aria-label="Đóng">✕</button>
      </div>
      <button onClick={open} className="block w-full px-3 py-2.5 text-left text-sm text-slate-800 transition-colors hover:bg-slate-50">
        {n.message}
        <span className="mt-1 block text-[11px] text-slate-400">{fmtTime(n.created_at)}</span>
      </button>
      <div className="flex items-center gap-1.5 border-t border-slate-100 bg-slate-50/50 px-3 py-1.5">
        <Button variant="ghost" className="px-2 py-0.5 text-xs" onClick={() => onSnooze(minutes)}>
          Nhắc tôi sau
        </Button>
        <input
          type="number" min={1} max={1440} value={minutes}
          onChange={(e) => setMinutes(Math.max(1, Number(e.target.value) || 15))}
          className="w-14 rounded-md border border-slate-200 px-1 py-0.5 text-center text-xs"
        />
        <span className="text-xs text-slate-500">phút</span>
      </div>
    </div>
  )
}
