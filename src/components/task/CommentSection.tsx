import { useState } from 'react'
import { useCurrentUser } from '../../context/AuthContext'
import { useAddComment, useComments } from '../../hooks/useTaskDetail'
import { canComment } from '../../lib/permissions'
import { fmtDateTime } from '../../lib/utils'
import { displayRole, type Task } from '../../types'
import { Button, Input } from '../ui'

/** Comment: chỉ tồn tại khi task Đang thực hiện. */
export default function CommentSection({ task }: { task: Task }) {
  const user = useCurrentUser()
  const { data: comments } = useComments(task.id)
  const addComment = useAddComment()
  const [content, setContent] = useState('')

  if (task.status !== 'dang_thuc_hien') return null // không có comment trong tab Hoàn thành

  const send = () => {
    const text = content.trim()
    if (!text) return
    addComment.mutate({ taskId: task.id, userId: user.id, content: text })
    setContent('')
  }

  return (
    <section>
      <h3 className="mb-1.5 text-xs font-bold uppercase text-gray-500">
        Trao đổi ({comments?.length ?? 0})
      </h3>
      <div className="max-h-56 space-y-2 overflow-y-auto border border-gray-200 p-2">
        {(comments ?? []).length === 0 && <p className="text-xs text-gray-400">Chưa có trao đổi nào.</p>}
        {(comments ?? []).map((c) => (
          <div key={c.id} className="text-xs">
            <span className="font-semibold">{c.user?.full_name ?? '—'}</span>
            {c.user && (c.user.role !== 'nhan_vien' || c.user.is_admin) && (
              <span className="ml-1 text-brand-600">({displayRole(c.user)})</span>
            )}
            <span className="ml-2 text-gray-400">{fmtDateTime(c.created_at)}</span>
            <p className="mt-0.5 whitespace-pre-wrap text-gray-800">{c.content}</p>
          </div>
        ))}
      </div>
      {canComment(task, user) && (
        <div className="mt-2 flex gap-2">
          <Input
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && send()}
            placeholder="Nhập trao đổi..."
          />
          <Button variant="primary" onClick={send} disabled={!content.trim()}>Gửi</Button>
        </div>
      )}
    </section>
  )
}
