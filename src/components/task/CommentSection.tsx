import { useState } from 'react'
import { useCurrentUser } from '../../context/AuthContext'
import { useAddComment, useComments } from '../../hooks/useTaskDetail'
import { canComment } from '../../lib/permissions'
import { fmtDateTime, initials } from '../../lib/utils'
import { displayRole, type Task } from '../../types'
import { Button, cardCls, Input } from '../ui'

/** Nhật ký xử lý công việc (Work Log — chức năng comment cũ, chỉ đổi cách hiển thị).
 *  Chỉ tồn tại khi task Đang thực hiện. Mới nhất trên cùng. */
export default function CommentSection({ task }: { task: Task }) {
  const user = useCurrentUser()
  const { data: comments } = useComments(task.id)
  const addComment = useAddComment()
  const [content, setContent] = useState('')

  if (task.status !== 'dang_thuc_hien') return null // không có nhật ký trong tab Hoàn thành

  const send = () => {
    const text = content.trim()
    if (!text) return
    addComment.mutate({ taskId: task.id, userId: user.id, content: text })
    setContent('')
  }

  // Mới nhất trên cùng
  const items = [...(comments ?? [])].sort((a, b) => b.created_at.localeCompare(a.created_at))

  return (
    <section className={`${cardCls} p-4`}>
      <h3 className="mb-3 border-b border-slate-50 pb-2 text-xs font-bold uppercase tracking-wider text-slate-400">
        Nhật ký xử lý công việc ({items.length})
      </h3>
      {canComment(task, user) && (
        <div className="mb-3 flex gap-2">
          <Input
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && send()}
            placeholder="Ghi nhật ký xử lý: đã làm gì, đang chờ gì..."
            className="bg-slate-50"
          />
          <Button variant="primary" onClick={send} disabled={!content.trim()}>Ghi</Button>
        </div>
      )}
      <div className="max-h-72 space-y-3 overflow-y-auto pr-1">
        {items.length === 0 && <p className="text-xs italic text-slate-400">Chưa có nhật ký nào.</p>}
        {items.map((c) => (
          <div key={c.id} className="flex items-start gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">
              {c.user ? initials(c.user.full_name) : '?'}
            </div>
            {/* Định dạng nhật ký: [ngày giờ] / Tên / Nội dung */}
            <div className="flex-1 rounded-xl rounded-tl-none border border-slate-100 bg-slate-50 p-2.5">
              <div className="font-mono text-[10px] font-bold text-slate-400">[{fmtDateTime(c.created_at)}]</div>
              <div className="mt-0.5 text-xs font-bold text-slate-900">
                {c.user?.full_name ?? '—'}
                {c.user && (c.user.role !== 'nhan_vien' || c.user.is_admin) && (
                  <span className="ml-1 text-[10px] font-medium text-violet-600">({displayRole(c.user)})</span>
                )}
              </div>
              <p className="mt-0.5 whitespace-pre-wrap text-xs text-slate-700">{c.content}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
