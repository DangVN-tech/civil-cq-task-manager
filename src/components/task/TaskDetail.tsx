import { useEffect, useState } from 'react'
import { useCurrentUser } from '../../context/AuthContext'
import { useTaskMutations } from '../../hooks/useTasks'
import { useActivityFeed, useUpdateReadActions, UPDATE_TYPE_LABEL } from '../../hooks/useUpdates'
import {
  canComplete, canDeleteTask, canEditTask, canReopenCompleted,
  canReturnTask, canUpdateProgress,
} from '../../lib/permissions'
import { AlignLeft, ChevronRight, EyeOff, History, Info as InfoIcon, Pencil, Trash2, TrendingUp } from 'lucide-react'
import { cn, fmtDate, fmtDateTime, fmtTime, initials, timeLeftLabel } from '../../lib/utils'
import type { Task } from '../../types'
import { Button, cardCls, ConfirmDialog, Dialog, ProgressSlider, Textarea } from '../ui'
import ActivityLogView from './ActivityLogView'
import CommentSection from './CommentSection'
import FileSection from './FileSection'
import MarkDot from './MarkDot'
import PriorityBadge from './PriorityBadge'
import TaskForm from './TaskForm'

/** Khung chi tiết task (cột phải): bố cục 2 cột theo mockup — trái nội dung chính, phải thuộc tính/tiến độ. */
export default function TaskDetail({ task }: { task: Task }) {
  const user = useCurrentUser()
  const { setProgress, completeTask, returnTask, reopenTask, deleteTask } = useTaskMutations()
  const { data: feed } = useActivityFeed(user.id)
  const { markRead, markUnread } = useUpdateReadActions(user.id)

  const [editOpen, setEditOpen] = useState(false)
  const [confirmComplete, setConfirmComplete] = useState(false)
  const [confirmReopen, setConfirmReopen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [returnOpen, setReturnOpen] = useState(false)
  const [returnReason, setReturnReason] = useState('')

  // Cập nhật mới nhất của riêng task này (mới nhất trước), lấy từ feed đã tải sẵn cho panel/badge
  const taskUpdates = (feed ?? [])
    .filter((it) => it.task_id === task.id)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
  const recentUpdates = taskUpdates.slice(0, 5)

  // Mở Task -> tự động đánh dấu đã đọc mọi cập nhật chưa đọc của task này
  useEffect(() => {
    const unreadIds = taskUpdates
      .filter((it) => !it.is_read && it.actor_id !== user.id)
      .map((it) => it.id)
    if (unreadIds.length > 0) markRead.mutate(unreadIds)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task.id, feed])

  const chuTri = task.assignees.find((a) => a.assign_role === 'chu_tri')
  const phoiHop = task.assignees.filter((a) => a.assign_role === 'phoi_hop')
  const inProgress = task.status === 'dang_thuc_hien'
  const left = timeLeftLabel(task.deadline) // null = không có deadline
  const overdue = inProgress && !!left?.overdue
  // Phối hợp = thành viên phòng + người ngoài phòng (nhập tự do)
  const phoiHopNames = [
    ...phoiHop.map((a) => a.user?.full_name ?? ''),
    ...(task.external_collabs ?? []).map((n) => `${n} (ngoài phòng)`),
  ].filter(Boolean)

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-slate-50/50">
      {/* Header */}
      <div className="flex flex-col gap-3 border-b border-slate-200 bg-white px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">
          {/* Breadcrumb Dự án › Đầu mục */}
          <div className="mb-1 flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
            <span className="truncate">{task.group?.project?.name ?? '—'}</span>
            <ChevronRight size={10} className="shrink-0" />
            <span className="truncate text-brand-600">{task.group?.name ?? '—'}</span>
          </div>
          <div className="flex items-center gap-2.5">
            <MarkDot task={task} />
            <h2 className="min-w-0 truncate text-lg font-extrabold tracking-tight text-slate-900">{task.title}</h2>
            <PriorityBadge priority={task.priority} />
          </div>
        </div>

        {/* Nút hành động theo quyền */}
        <div className="flex shrink-0 flex-wrap gap-2">
          {inProgress && canComplete(task, user) && (
            <Button variant="primary" onClick={() => setConfirmComplete(true)}>✓ Xác nhận hoàn thành</Button>
          )}
          {!inProgress && canReopenCompleted(task, user) && (
            <Button onClick={() => setConfirmReopen(true)}><Pencil size={13} /> Sửa</Button>
          )}
          {!inProgress && canReturnTask(user) && (
            <Button variant="danger" onClick={() => { setReturnReason(''); setReturnOpen(true) }}>Trả về</Button>
          )}
          {inProgress && canEditTask(user) && (
            <Button onClick={() => setEditOpen(true)}><Pencil size={13} /> Sửa task</Button>
          )}
          {canDeleteTask(user) && (
            <Button variant="ghost" className="text-rose-600 hover:bg-rose-50" onClick={() => setConfirmDelete(true)}>
              <Trash2 size={13} /> Xóa task
            </Button>
          )}
          {taskUpdates.length > 0 && (
            <Button
              variant="ghost"
              title="Đánh dấu toàn bộ cập nhật của task này là chưa đọc"
              onClick={() => markUnread.mutate(taskUpdates.map((it) => it.id))}
            >
              <EyeOff size={13} /> Đánh dấu chưa đọc
            </Button>
          )}
        </div>
      </div>

      <div className="px-5 py-4">
        {/* Lý do trả về gần nhất */}
        {inProgress && task.last_return_reason && (
          <div className="mb-4 rounded-r-xl border-l-4 border-rose-500 bg-rose-50 p-3 text-xs text-rose-700 shadow-sm">
            <b className="text-rose-900">Task bị trả về.</b> Lý do: {task.last_return_reason}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* ===== Cột trái (rộng): nội dung xử lý công việc ===== */}
          <div className="space-y-4 lg:col-span-2">
            {/* Mô tả */}
            <section className={`${cardCls} p-4`}>
              <h3 className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                <AlignLeft size={14} className="text-brand-500" /> Mô tả công việc
              </h3>
              <p className="whitespace-pre-wrap rounded-lg border border-slate-100 bg-slate-50 p-3 text-xs leading-relaxed text-slate-600">
                {task.description || '—'}
              </p>
            </section>

            {/* Cập nhật mới nhất: 3-5 dòng gần nhất (nhật ký/deadline/trả về/upload), trước Work Log */}
            {recentUpdates.length > 0 && (
              <section className={`${cardCls} p-4`}>
                <h3 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                  <History size={14} className="text-brand-500" /> Cập nhật mới nhất
                </h3>
                <div className="space-y-2.5">
                  {recentUpdates.map((it) => (
                    <div key={it.id} className="flex items-start gap-2.5 text-xs">
                      <button
                        onClick={() => (it.is_read ? markUnread.mutate([it.id]) : markRead.mutate([it.id]))}
                        title={it.is_read ? 'Đánh dấu chưa đọc' : 'Đánh dấu đã đọc'}
                        className="mt-1 shrink-0"
                      >
                        <span className={cn(
                          'block h-2 w-2 rounded-full border',
                          it.is_read ? 'border-slate-300' : 'border-brand-500 bg-brand-500',
                        )} />
                      </button>
                      <div className="min-w-0 flex-1">
                        <span className="font-mono text-[10px] font-bold text-slate-400">{fmtTime(it.created_at)}</span>{' '}
                        <span className="font-bold text-slate-800">{it.actor_name ?? 'Trưởng phòng'}</span>{' '}
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                          {UPDATE_TYPE_LABEL[it.event_type] ?? it.event_type}
                        </span>
                        <p className="mt-0.5 text-slate-600">{it.detail}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <CommentSection task={task} />
            <ActivityLogView taskId={task.id} />
          </div>

          {/* ===== Cột phải (hẹp): tiến độ + thông tin quản lý + file ===== */}
          <div className="space-y-4">
            {/* Tiến độ */}
            <section className={`${cardCls} p-4`}>
              <div className="mb-2.5 flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                  <TrendingUp size={14} className="text-brand-500" /> Tiến độ hiện tại
                </h3>
                <span className={cn(
                  'rounded-full px-2 py-0.5 text-sm font-extrabold',
                  task.progress >= 100 ? 'bg-emerald-50 text-emerald-600' : 'bg-brand-50 text-brand-600',
                )}>
                  {task.progress}%
                </span>
              </div>
              {canUpdateProgress(task, user) ? (
                <ProgressSlider
                  value={task.progress}
                  onChange={(v) => setProgress.mutate({ taskId: task.id, progress: v })}
                />
              ) : (
                <>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={cn('h-full rounded-full', task.progress >= 100 ? 'bg-emerald-500' : 'bg-brand-500')}
                      style={{ width: `${task.progress}%` }}
                    />
                  </div>
                  {inProgress && (
                    <p className="mt-1.5 text-[11px] italic text-slate-400">Chỉ Chủ trì được cập nhật tiến độ.</p>
                  )}
                </>
              )}
            </section>

            {/* Thông tin quản lý */}
            <section className={`${cardCls} p-4`}>
              <h3 className="mb-3 flex items-center gap-2 border-b border-slate-100 pb-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                <InfoIcon size={14} className="text-brand-500" /> Thông tin quản lý
              </h3>
              <div className="space-y-3 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="shrink-0 font-semibold text-slate-400">Chủ trì:</span>
                  <div className="flex min-w-0 items-center gap-2">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[9px] font-bold text-brand-700">
                      {chuTri?.user ? initials(chuTri.user.full_name) : '?'}
                    </div>
                    <span className="truncate font-bold text-slate-700">{chuTri?.user?.full_name ?? '—'}</span>
                  </div>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <span className="shrink-0 font-semibold text-slate-400">Phối hợp:</span>
                  <span className="truncate rounded border border-slate-100 bg-slate-50 px-2 py-0.5 text-right text-[11px] italic text-slate-500">
                    {phoiHopNames.length > 0 ? phoiHopNames.join(', ') : 'Không (Chủ trì tự thực hiện)'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-400">Ngày giao:</span>
                  <span className="rounded-md border border-slate-100 bg-slate-50 px-2.5 py-0.5 text-[11px] font-bold text-slate-700">
                    {fmtDate(task.assigned_date)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="shrink-0 font-semibold text-slate-400">Hạn chót:</span>
                  <span className={cn(
                    'truncate rounded-md border px-2.5 py-0.5 text-right text-[11px] font-bold',
                    overdue ? 'border-rose-100 bg-rose-50 text-rose-600' : 'border-amber-100 bg-amber-50 text-amber-600',
                  )}>
                    {task.deadline
                      ? `${fmtDateTime(task.deadline)}${inProgress && left ? ` (${left.text})` : ''}`
                      : 'Không có — việc thường xuyên'}
                  </span>
                </div>
                {!inProgress && task.completed_at && (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-400">Hoàn thành lúc:</span>
                      <span className="font-bold text-slate-700">{fmtDateTime(task.completed_at)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-400">Người hoàn thành:</span>
                      <span className="font-bold text-slate-700">{task.completer?.full_name ?? chuTri?.user?.full_name ?? '—'}</span>
                    </div>
                  </>
                )}
              </div>
            </section>

            <FileSection task={task} />
          </div>
        </div>
      </div>

      {/* ===== Dialogs ===== */}
      <TaskForm open={editOpen} onClose={() => setEditOpen(false)} editing={task} />

      <ConfirmDialog
        open={confirmComplete} onClose={() => setConfirmComplete(false)}
        title="Xác nhận hoàn thành"
        message={<>Task <b>{task.title}</b> sẽ chuyển sang tab <b>Hoàn thành</b>.</>}
        onConfirm={() => completeTask.mutate({ taskId: task.id, userId: user.id })}
      />

      <ConfirmDialog
        open={confirmReopen} onClose={() => setConfirmReopen(false)}
        title="Sửa task"
        message="Task sẽ quay lại trạng thái Đang thực hiện."
        onConfirm={() => reopenTask.mutate(task.id)}
      />

      <ConfirmDialog
        open={confirmDelete} onClose={() => setConfirmDelete(false)}
        title="Xóa task" danger confirmLabel="Xóa"
        message={<>Xóa vĩnh viễn task <b>{task.title}</b> cùng toàn bộ file, trao đổi? Không thể hoàn tác.</>}
        onConfirm={() => deleteTask.mutate(task.id)}
      />

      {/* Trả về: bắt buộc nhập lý do */}
      <Dialog open={returnOpen} onClose={() => setReturnOpen(false)} title="Trả về" width="max-w-md">
        <p className="mb-2 text-sm">
          Task <b>{task.title}</b> sẽ quay lại trạng thái <b>Đang thực hiện</b>.
        </p>
        <Textarea
          autoFocus value={returnReason}
          onChange={(e) => setReturnReason(e.target.value)}
          placeholder="Lý do trả về (bắt buộc nhập)"
        />
        <div className="mt-3 flex justify-end gap-2">
          <Button onClick={() => setReturnOpen(false)}>Hủy</Button>
          <Button
            variant="danger" disabled={!returnReason.trim()}
            onClick={() => {
              returnTask.mutate({ taskId: task.id, reason: returnReason.trim(), userId: user.id })
              setReturnOpen(false)
            }}
          >
            Trả về
          </Button>
        </div>
      </Dialog>
    </div>
  )
}
