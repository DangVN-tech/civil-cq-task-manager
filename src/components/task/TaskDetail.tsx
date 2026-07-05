import { useState } from 'react'
import { useCurrentUser } from '../../context/AuthContext'
import { useTaskMutations } from '../../hooks/useTasks'
import {
  canComplete, canDeleteTask, canEditTask, canReopenCompleted,
  canReturnTask, canUpdateProgress,
} from '../../lib/permissions'
import { cn, fmtDate, fmtDateTime, timeLeftLabel } from '../../lib/utils'
import type { Task } from '../../types'
import { Button, cardCls, ConfirmDialog, Dialog, ProgressBar, Select, Textarea } from '../ui'
import ActivityLogView from './ActivityLogView'
import CommentSection from './CommentSection'
import FileSection from './FileSection'
import MarkDot from './MarkDot'
import PriorityBadge from './PriorityBadge'
import TaskForm from './TaskForm'

/** Khung chi tiết task (cột phải). */
export default function TaskDetail({ task }: { task: Task }) {
  const user = useCurrentUser()
  const { setProgress, completeTask, returnTask, reopenTask, deleteTask } = useTaskMutations()

  const [editOpen, setEditOpen] = useState(false)
  const [confirmComplete, setConfirmComplete] = useState(false)
  const [confirmReopen, setConfirmReopen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [returnOpen, setReturnOpen] = useState(false)
  const [returnReason, setReturnReason] = useState('')

  const chuTri = task.assignees.find((a) => a.assign_role === 'chu_tri')
  const phoiHop = task.assignees.filter((a) => a.assign_role === 'phoi_hop')
  const inProgress = task.status === 'dang_thuc_hien'
  const left = timeLeftLabel(task.deadline) // null = không có deadline
  // Phối hợp = thành viên phòng + người ngoài phòng (nhập tự do)
  const phoiHopNames = [
    ...phoiHop.map((a) => a.user?.full_name ?? ''),
    ...(task.external_collabs ?? []).map((n) => `${n} (ngoài phòng)`),
  ].filter(Boolean)

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-slate-50/50">
      {/* Header */}
      <div className="border-b border-slate-100 bg-white px-5 py-4">
        <div className="flex items-center gap-2.5">
          <MarkDot task={task} />
          <h2 className="min-w-0 flex-1 truncate text-lg font-bold text-slate-900">{task.title}</h2>
          <PriorityBadge priority={task.priority} />
        </div>

        {/* Nút hành động theo quyền */}
        <div className="mt-2 flex flex-wrap gap-2">
          {inProgress && canComplete(task, user) && (
            <Button variant="primary" onClick={() => setConfirmComplete(true)}>✓ Xác nhận hoàn thành</Button>
          )}
          {!inProgress && canReopenCompleted(task, user) && (
            <Button onClick={() => setConfirmReopen(true)}>Sửa</Button>
          )}
          {!inProgress && canReturnTask(user) && (
            <Button variant="danger" onClick={() => { setReturnReason(''); setReturnOpen(true) }}>Trả về</Button>
          )}
          {inProgress && canEditTask(user) && (
            <Button onClick={() => setEditOpen(true)}>Sửa task</Button>
          )}
          {canDeleteTask(user) && (
            <Button variant="ghost" className="text-red-600" onClick={() => setConfirmDelete(true)}>Xóa task</Button>
          )}
        </div>
      </div>

      <div className="space-y-4 px-5 py-4">
        {/* Lý do trả về gần nhất */}
        {inProgress && task.last_return_reason && (
          <div className="rounded-r-xl border-l-4 border-rose-500 bg-rose-50 p-3 text-xs text-rose-700 shadow-sm">
            <b className="text-rose-900">Task bị trả về.</b> Lý do: {task.last_return_reason}
          </div>
        )}

        {/* Thông tin chung */}
        <div className={`${cardCls} grid grid-cols-2 gap-x-6 gap-y-2 p-4 text-xs`}>
          <Info label="Dự án / Gói thầu" value={task.group?.project?.name ?? '—'} />
          <Info label="Nhóm công việc" value={task.group?.name ?? '—'} />
          <Info label="Ngày giao việc" value={fmtDate(task.assigned_date)} />
          <Info label="Deadline"
            value={task.deadline
              ? `${fmtDateTime(task.deadline)}${inProgress && left ? ` (${left.text})` : ''}`
              : 'Không có — việc thường xuyên, cập nhật mỗi ngày'}
            danger={inProgress && !!left?.overdue} />
          <Info label="Chủ trì" value={chuTri?.user?.full_name ?? '—'} />
          <Info label="Phối hợp"
            value={phoiHopNames.length > 0 ? phoiHopNames.join(', ') : 'Không (Chủ trì tự thực hiện)'} />
          {!inProgress && task.completed_at && (
            <>
              <Info label="Hoàn thành lúc" value={fmtDateTime(task.completed_at)} />
              <Info label="Người hoàn thành" value={task.completer?.full_name ?? chuTri?.user?.full_name ?? '—'} />
            </>
          )}
        </div>

        {/* Tiến độ */}
        <section className={`${cardCls} p-4`}>
          <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">Tiến độ</h3>
          <div className="flex items-center gap-3">
            <ProgressBar value={task.progress} className="h-3 flex-1" />
            <span className={`text-sm font-bold ${task.progress >= 100 ? 'text-emerald-600' : 'text-slate-800'}`}>{task.progress}%</span>
            {canUpdateProgress(task, user) && (
              <Select
                value={task.progress}
                onChange={(e) => setProgress.mutate({ taskId: task.id, progress: Number(e.target.value) })}
                className="w-24"
              >
                {Array.from({ length: 11 }, (_, i) => i * 10).map((p) => (
                  <option key={p} value={p}>{p}%</option>
                ))}
              </Select>
            )}
          </div>
          {inProgress && !canUpdateProgress(task, user) && (
            <p className="mt-1.5 text-[11px] italic text-slate-400">Chỉ Chủ trì được cập nhật tiến độ.</p>
          )}
        </section>

        {/* Mô tả */}
        <section className={`${cardCls} p-4`}>
          <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">Mô tả công việc</h3>
          <p className="whitespace-pre-wrap rounded-lg border border-slate-100 bg-slate-50 p-3 text-sm font-medium leading-relaxed text-slate-700">
            {task.description || '—'}
          </p>
        </section>

        <FileSection task={task} />
        <CommentSection task={task} />
        <ActivityLogView taskId={task.id} />
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

function Info({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <p className="flex items-baseline justify-between gap-3">
      <span className="shrink-0 text-slate-400">{label}</span>
      <span className={cn('text-right', danger ? 'font-semibold text-rose-600' : 'font-semibold text-slate-800')}>
        {value}
      </span>
    </p>
  )
}
