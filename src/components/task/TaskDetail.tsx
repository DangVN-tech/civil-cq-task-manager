import { Fragment, useEffect, useRef, useState } from 'react'
import { useCurrentUser } from '../../context/AuthContext'
import { useActivityLog, useAddComment, useDeleteComment } from '../../hooks/useTaskDetail'
import { useTaskMutations } from '../../hooks/useTasks'
import { useActivityFeed, useUpdateReadActions } from '../../hooks/useUpdates'
import {
  canApproveCompletion, canComment, canComplete, canDeleteTask, canEditTask, canReopenCompleted,
  canReturnTask, canUpdateProgress, canViewTaskFull, canWithdrawReview, isTruongPhong,
} from '../../lib/permissions'
import { uploadCommentImage } from '../../lib/files'
import { AlignLeft, ChevronRight, ClipboardList, Eye, EyeOff, Image as ImageIcon, Info as InfoIcon, PenLine, Pencil, Trash2, TrendingUp, X } from 'lucide-react'
import { cn, fmtDate, fmtDateTime, initials, timeLeftLabel } from '../../lib/utils'
import type { Task } from '../../types'
import { Button, cardCls, ConfirmDialog, Dialog, ProgressSlider, Textarea } from '../ui'
import FileSection from './FileSection'
import MarkDot from './MarkDot'
import PriorityBadge from './PriorityBadge'
import TaskForm from './TaskForm'

/** Parse và render nội dung nhật ký: xử lý [deleted] và [img:url] patterns. */
function renderDetail(detail: string, unread: boolean, onLightbox: (url: string) => void) {
  if (detail === '[deleted]') {
    return <p className="mt-0.5 text-xs italic text-slate-400">🚫 Tin nhắn đã bị xóa bởi Trưởng phòng</p>
  }
  const parts = detail.split(/(\[img:[^\]]+\])/g)
  return (
    <div className="mt-0.5">
      {parts.map((part, i) => {
        const match = part.match(/^\[img:(.+)\]$/)
        if (match) {
          return (
            <img
              key={i}
              src={match[1]}
              className="mt-1.5 max-h-44 cursor-pointer rounded-lg border border-slate-200 shadow-sm hover:opacity-90"
              onClick={() => onLightbox(match[1])}
              alt="ảnh đính kèm"
            />
          )
        }
        return part ? (
          <p key={i} className={cn('whitespace-pre-wrap text-sm', unread ? 'font-semibold text-slate-800' : 'text-slate-500')}>
            {part}
          </p>
        ) : null
      })}
    </div>
  )
}

/** Khung chi tiết task (cột phải): bố cục 2 cột theo mockup — trái nội dung chính, phải thuộc tính/tiến độ. */
export default function TaskDetail({ task }: { task: Task }) {
  const user = useCurrentUser()
  const { setProgress, completeTask, approveTask, withdrawReview, returnTask, reopenTask, deleteTask } = useTaskMutations()
  const { data: feed } = useActivityFeed(user.id)
  const { markRead, markUnread } = useUpdateReadActions(user.id)
  const { data: activityRows } = useActivityLog(task.id)
  const addComment = useAddComment()
  const deleteComment = useDeleteComment()
  const [commentContent, setCommentContent] = useState('')
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null)

  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)
  const [pendingImages, setPendingImages] = useState<{ file: File; preview: string }[]>([])
  const [uploadingImage, setUploadingImage] = useState(false)
  const imgInputRef = useRef<HTMLInputElement>(null)

  const [editOpen, setEditOpen] = useState(false)
  const [confirmComplete, setConfirmComplete] = useState(false)
  const [confirmApprove, setConfirmApprove] = useState(false)
  const [confirmWithdraw, setConfirmWithdraw] = useState(false)
  const [confirmReopen, setConfirmReopen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [returnOpen, setReturnOpen] = useState(false)
  const [returnReason, setReturnReason] = useState('')

  // Cập nhật mới nhất của riêng task này (mới nhất trước), lấy từ feed đã tải sẵn cho panel/badge
  const taskUpdates = (feed ?? [])
    .filter((it) => it.task_id === task.id)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
  // Không tính hành động của chính mình (không cần đánh dấu đọc/chưa đọc việc mình vừa làm)
  const othersUpdates = taskUpdates.filter((it) => it.actor_id !== user.id)

  // Ghi nhớ IDs unread lúc MỞ task — chỉ những này mới được mark-read khi rời
  // (không đụng item user tự tay mark-unread sau khi mở)
  const unreadOnOpenRef = useRef<number[]>([])
  const capturedRef = useRef<string | null>(null)
  useEffect(() => {
    if (!feed || capturedRef.current === task.id) return
    capturedRef.current = task.id
    unreadOnOpenRef.current = othersUpdates.filter((it) => !it.is_read).map((it) => it.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task.id, feed])

  // Mark-read KHI RỜI task (unmount) — chỉ những item unread lúc mở, không hơn
  const markReadRef = useRef(markRead)
  markReadRef.current = markRead
  useEffect(() => {
    return () => {
      capturedRef.current = null
      if (unreadOnOpenRef.current.length > 0) {
        markReadRef.current.mutate(unreadOnOpenRef.current)
        unreadOnOpenRef.current = []
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task.id])

  // Revoke object URLs khi component unmount để tránh memory leak
  useEffect(() => {
    return () => { pendingImages.forEach(({ preview }) => URL.revokeObjectURL(preview)) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Merge activity_log (tất cả events) với is_read từ activity_feed (enrichment per-user)
  const feedMap = new Map(taskUpdates.map((it) => [it.id, it]))
  const mergedLog = (activityRows ?? [])
    .map((row) => {
      const feedItem = feedMap.get(row.id)
      return {
        ...row,
        is_read: feedItem?.is_read ?? true,
        actor_name: feedItem?.actor_name ?? null,
        actor_is_truong_phong: feedItem?.actor_is_truong_phong ?? false,
        inFeed: !!feedItem,
      }
    })
    .sort((a, b) => b.created_at.localeCompare(a.created_at))

  const sendComment = async () => {
    const text = commentContent.trim()
    if (!text && pendingImages.length === 0) return
    setUploadingImage(true)
    try {
      const uploadedUrls = await Promise.all(pendingImages.map(({ file }) => uploadCommentImage(file, task.id)))
      const imgParts = uploadedUrls.map((u) => `[img:${u}]`).join('\n')
      const content = [text, imgParts].filter(Boolean).join('\n')
      addComment.mutate({ taskId: task.id, userId: user.id, content })
      setCommentContent('')
      pendingImages.forEach(({ preview }) => URL.revokeObjectURL(preview))
      setPendingImages([])
    } catch {
      // silently fail — user can retry
    } finally {
      setUploadingImage(false)
    }
  }

  const handleImageSelect = (files: File[]) => {
    const newImages = files.map((f) => ({ file: f, preview: URL.createObjectURL(f) }))
    setPendingImages((prev) => [...prev, ...newImages])
    if (imgInputRef.current) imgInputRef.current.value = ''
  }

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const imageFiles = Array.from(e.clipboardData.files).filter((f) => f.type.startsWith('image/'))
    if (imageFiles.length === 0) return
    e.preventDefault()
    const newImages = imageFiles.map((f) => ({ file: f, preview: URL.createObjectURL(f) }))
    setPendingImages((prev) => [...prev, ...newImages])
  }

  const full = canViewTaskFull(task, user)
  const chuTri = task.assignees.find((a) => a.assign_role === 'chu_tri')
  const phoiHop = task.assignees.filter((a) => a.assign_role === 'phoi_hop')
  const inProgress = task.status === 'dang_thuc_hien'
  const pendingReview = task.status === 'cho_duyet'
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
            <Button variant="primary" onClick={() => setConfirmComplete(true)}>✓ Hoàn tất</Button>
          )}
          {pendingReview && canApproveCompletion(task, user) && (
            <Button variant="primary" onClick={() => setConfirmApprove(true)}>✓ Xác nhận hoàn thành</Button>
          )}
          {pendingReview && canWithdrawReview(task, user) && (
            <Button onClick={() => setConfirmWithdraw(true)}>↩ Hủy gửi duyệt</Button>
          )}
          {task.status === 'hoan_thanh' && canReopenCompleted(task, user) && (
            <Button onClick={() => setConfirmReopen(true)}><Pencil size={13} /> Sửa</Button>
          )}
          {(pendingReview || task.status === 'hoan_thanh') && canReturnTask(user) && (
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
        </div>
      </div>

      <div className="px-5 py-4">
        {!full ? (
          /* Không tham gia task này: chỉ thông tin chung — tên task (đã ở header), người phụ trách, deadline */
          <section className={cn(cardCls, 'overflow-hidden')}>
            <div className="h-[3px] bg-slate-300" />
            <div className="space-y-3 p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="shrink-0 text-xs font-semibold text-slate-400">Người phụ trách:</span>
                <div className="flex min-w-0 items-center gap-2">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[9px] font-bold text-brand-700">
                    {chuTri?.user ? initials(chuTri.user.full_name) : '?'}
                  </div>
                  <span className="truncate text-xs font-bold text-slate-700">{chuTri?.user?.full_name ?? '—'}</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400">Hạn chót:</span>
                <span className="rounded-md border border-slate-100 bg-slate-50 px-2.5 py-0.5 text-[11px] font-bold text-slate-700">
                  {task.deadline
                    ? `${fmtDateTime(task.deadline)}${inProgress && left ? ` (${left.text})` : ''}`
                    : 'Không có — việc thường xuyên'}
                </span>
              </div>
              <p className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-xs italic text-slate-400">
                Bạn không tham gia công việc này nên chỉ xem được thông tin chung. Liên hệ Trưởng phòng nếu cần biết thêm chi tiết.
              </p>
            </div>
          </section>
        ) : (
        <>
        {/* Lý do trả về gần nhất */}
        {inProgress && task.last_return_reason && (
          <div className="mb-4 rounded-r-xl border-l-4 border-rose-500 bg-rose-50 p-3 text-xs text-rose-700 shadow-sm">
            <b className="text-rose-900">Task bị trả về.</b> Lý do: {task.last_return_reason}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* ===== Cột trái (rộng): mô tả + nhật ký thống nhất ===== */}
          <div className="space-y-4 lg:col-span-2">
            {/* Mô tả */}
            <section className={cn(cardCls, 'overflow-hidden')}>
              <div className="h-[3px] bg-indigo-500" />
              <div className="p-4">
                <h3 className="mb-2 flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-slate-700">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50">
                    <AlignLeft size={14} className="text-indigo-600" />
                  </span>
                  Mô tả công việc
                </h3>
                <p className="whitespace-pre-wrap rounded-lg border border-slate-100 bg-slate-50 p-3 text-sm leading-relaxed text-slate-600">
                  {task.description || '—'}
                </p>
              </div>
            </section>

            {/* Tab A: Nhật ký xử lý công việc — gộp activity_feed + activity_log */}
            {mergedLog.length > 0 && (
              <section className={cn(cardCls, 'overflow-hidden')}>
                <div className="h-[3px] bg-slate-400" />
                <div className="p-4">
                  <h3 className="mb-3 flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-slate-700">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-50">
                      <ClipboardList size={14} className="text-slate-500" />
                    </span>
                    Nhật ký xử lý công việc ({mergedLog.length})
                  </h3>
                  <div className="max-h-[480px] overflow-y-auto pr-1">
                    <div className="ml-2 space-y-0">
                      {(() => {
                        const lastUnreadIdx = mergedLog.reduce(
                          (max, it, idx) => (!it.is_read && it.actor_id !== user.id ? idx : max),
                          -1,
                        )
                        const hasUnread = lastUnreadIdx >= 0
                        return mergedLog.map((it, idx) => {
                          const isMine = it.actor_id === user.id
                          const unread = !it.is_read && !isMine
                          const showDivider = hasUnread && idx === lastUnreadIdx + 1
                          return (
                            <Fragment key={it.id}>
                              {showDivider && (
                                <div className="ml-6 flex items-center gap-2 py-1.5">
                                  <div className="h-px flex-1 bg-slate-200" />
                                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Đã đọc</span>
                                  <div className="h-px w-4 bg-slate-200" />
                                </div>
                              )}
                              <div className="flex gap-3">
                                {/* Cột trái: dot + connector line */}
                                <div className="flex w-4 flex-col items-center">
                                  <div className={cn(
                                    'mt-2 h-2.5 w-2.5 shrink-0 rounded-full border-2 border-white ring-4',
                                    idx === 0
                                      ? 'bg-indigo-600 ring-indigo-100'
                                      : it.event_type === 'comment'
                                      ? 'bg-blue-400 ring-blue-50'
                                      : 'bg-slate-300 ring-slate-100',
                                  )} />
                                  {idx < mergedLog.length - 1 && (
                                    <div className="mt-1 w-px flex-1 bg-slate-200" />
                                  )}
                                </div>
                                {/* Cột phải: content card */}
                                <div className={cn(
                                  'mb-3 flex-1 rounded-xl border border-slate-200/80 bg-white p-3 shadow-sm',
                                  unread && 'border-l-2 border-brand-500 bg-brand-50/30',
                                )}>
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0 flex-1">
                                      <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
                                        <span className={cn('font-mono text-[10px] font-extrabold', unread ? 'text-brand-600' : 'text-slate-400')}>
                                          [{fmtDateTime(it.created_at)}]
                                        </span>
                                        {it.actor_name && (
                                          <>
                                            <span className={cn('text-xs font-bold', unread ? 'text-slate-800' : 'text-slate-600')}>
                                              {it.actor_name}
                                            </span>
                                            {it.actor_is_truong_phong && (
                                              <span className="text-[10px] font-medium text-violet-600">(Trưởng phòng)</span>
                                            )}
                                          </>
                                        )}
                                      </div>
                                      {renderDetail(it.detail, unread, setLightboxUrl)}
                                    </div>
                                    {/* Trailing actions */}
                                    <div className="flex shrink-0 items-center gap-1">
                                      {!isMine && it.inFeed && (
                                        <button
                                          onClick={() => (it.is_read ? markUnread.mutate([it.id]) : markRead.mutate([it.id]))}
                                          title={it.is_read ? 'Đánh dấu chưa đọc' : 'Đánh dấu đã đọc'}
                                          className={cn(
                                            'flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold transition-colors',
                                            it.is_read
                                              ? 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'
                                              : 'bg-brand-100 text-brand-700 hover:bg-brand-200',
                                          )}
                                        >
                                          {it.is_read ? <EyeOff size={12} /> : <Eye size={12} />}
                                        </button>
                                      )}
                                      {it.event_type === 'comment' && isTruongPhong(user) && it.detail !== '[deleted]' && (
                                        <button
                                          onClick={() => setDeleteTargetId(it.id)}
                                          title="Xóa bình luận"
                                          className="flex shrink-0 items-center rounded-md p-1 text-slate-300 transition-colors hover:bg-rose-50 hover:text-rose-500"
                                        >
                                          <Trash2 size={12} />
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </Fragment>
                          )
                        })
                      })()}
                    </div>
                  </div>
                </div>
              </section>
            )}
          </div>

          {/* ===== Cột phải (hẹp): tiến độ + thông tin quản lý + Tab B ===== */}
          <div className="space-y-4">
            {/* Tiến độ */}
            <section className={cn(cardCls, 'overflow-hidden')}>
              <div className={cn('h-[3px]', task.progress >= 100 ? 'bg-emerald-500' : 'bg-amber-500')} />
              <div className="p-4">
              <div className="mb-2.5 flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-slate-700">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50">
                    <TrendingUp size={14} className="text-amber-600" />
                  </span>
                  Tiến độ hiện tại
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
                  {pendingReview && (
                    <p className="mt-1.5 text-[11px] italic text-amber-500">Đang chờ Trưởng phòng duyệt.</p>
                  )}
                </>
              )}
              </div>
            </section>

            {/* Thông tin quản lý */}
            <section className={cn(cardCls, 'overflow-hidden')}>
              <div className="h-[3px] bg-emerald-500" />
              <div className="p-4">
              <h3 className="mb-3 flex items-center gap-2 border-b border-slate-100 pb-2 text-xs font-extrabold uppercase tracking-wider text-slate-700">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50">
                  <InfoIcon size={14} className="text-emerald-600" />
                </span>
                Thông tin quản lý
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
              </div>
            </section>

            {/* Tab B: Ghi nhật ký xử lý + tài liệu đính kèm */}
            <section className={cn(cardCls, 'overflow-hidden')}>
              <div className="h-[3px] bg-indigo-500" />
              <div className="p-4">
              <h3 className="mb-3 flex items-center gap-2 border-b border-slate-50 pb-2 text-xs font-extrabold uppercase tracking-wider text-slate-700">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50">
                  <PenLine size={14} className="text-indigo-600" />
                </span>
                Ghi nhật ký xử lý
              </h3>
              {canComment(task, user) && (
                <div className="mb-4">
                  <div className="flex gap-2">
                    <Textarea
                      rows={3}
                      value={commentContent}
                      onChange={(e) => setCommentContent(e.target.value)}
                      onPaste={handlePaste}
                      placeholder="Đã làm gì, đang chờ gì... (Ctrl+V để dán ảnh)"
                      className="bg-slate-50"
                    />
                    <div className="flex flex-col gap-1.5">
                      <Button variant="primary" onClick={sendComment} disabled={uploadingImage || (!commentContent.trim() && pendingImages.length === 0)}>
                        {uploadingImage ? '...' : 'Ghi'}
                      </Button>
                      <button
                        type="button"
                        onClick={() => imgInputRef.current?.click()}
                        disabled={uploadingImage}
                        title="Gửi ảnh"
                        className="flex items-center justify-center rounded-xl border border-slate-200 bg-white p-2 text-slate-500 transition hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-600 disabled:opacity-50"
                      >
                        <ImageIcon size={16} />
                      </button>
                      <input
                        ref={imgInputRef}
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={(e) => handleImageSelect(Array.from(e.target.files ?? []))}
                      />
                    </div>
                  </div>
                  {uploadingImage && (
                    <p className="mt-1.5 text-[11px] text-indigo-500">Đang tải ảnh lên...</p>
                  )}
                  {pendingImages.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {pendingImages.map((img, i) => (
                        <div key={i} className="relative">
                          <img src={img.preview} className="h-16 w-16 rounded-lg border border-slate-200 object-cover" alt="ảnh" />
                          <button
                            onClick={() => {
                              URL.revokeObjectURL(img.preview)
                              setPendingImages((prev) => prev.filter((_, j) => j !== i))
                            }}
                            className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-white shadow"
                          >
                            <X size={10} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <div className={cn(canComment(task, user) ? 'border-t border-slate-100 pt-3' : '')}>
                <FileSection task={task} embedded />
              </div>
              </div>
            </section>
          </div>
        </div>
        </>
        )}
      </div>

      {/* ===== Dialogs ===== */}
      <TaskForm open={editOpen} onClose={() => setEditOpen(false)} editing={task} />

      <ConfirmDialog
        open={confirmComplete} onClose={() => setConfirmComplete(false)}
        title="Hoàn tất"
        message={<>Task <b>{task.title}</b> sẽ chuyển sang tab <b>Chờ duyệt</b>, chờ Trưởng phòng xác nhận.</>}
        onConfirm={() => completeTask.mutate({ taskId: task.id, userId: user.id })}
      />

      <ConfirmDialog
        open={confirmApprove} onClose={() => setConfirmApprove(false)}
        title="Xác nhận hoàn thành"
        message={<>Task <b>{task.title}</b> sẽ chuyển sang tab <b>Hoàn thành</b>.</>}
        onConfirm={() => approveTask.mutate({ taskId: task.id, userId: user.id })}
      />

      <ConfirmDialog
        open={confirmWithdraw} onClose={() => setConfirmWithdraw(false)}
        title="Hủy gửi duyệt"
        message={<>Task <b>{task.title}</b> sẽ quay lại trạng thái <b>Đang thực hiện</b> để bạn tiếp tục xử lý.</>}
        onConfirm={() => withdrawReview.mutate(task.id)}
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

      <ConfirmDialog
        open={deleteTargetId !== null} onClose={() => setDeleteTargetId(null)}
        title="Xóa bình luận" danger confirmLabel="Xóa"
        message="Tin nhắn sẽ được đánh dấu là đã xóa và hiển thị thông báo cho mọi người."
        onConfirm={() => {
          deleteComment.mutate({ activityId: deleteTargetId!, taskId: task.id })
          setDeleteTargetId(null)
        }}
      />

      {/* Lightbox ảnh */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
          onClick={() => setLightboxUrl(null)}
        >
          <img
            src={lightboxUrl}
            className="max-h-[90vh] max-w-[90vw] rounded-xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            alt="ảnh phóng to"
          />
          <button
            onClick={() => setLightboxUrl(null)}
            className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/30"
          >
            <X size={20} />
          </button>
        </div>
      )}

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
