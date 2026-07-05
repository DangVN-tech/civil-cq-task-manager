import { useEffect, useMemo, useState } from 'react'
import { format } from 'date-fns'
import { useCurrentUser } from '../../context/AuthContext'
import { useUsers } from '../../hooks/useUsers'
import { useTaskMutations, type TaskInput } from '../../hooks/useTasks'
import { uploadTaskFiles, validateFiles } from '../../lib/files'
import { cn } from '../../lib/utils'
import { PRIORITY_LABEL, type Priority, type Task } from '../../types'
import { Button, Dialog, Field, Input, Select, Textarea } from '../ui'

/** Form tạo / sửa task — chỉ Trưởng phòng. */
export default function TaskForm({
  open,
  onClose,
  editing,
}: {
  open: boolean
  onClose: () => void
  editing?: Task | null
}) {
  const user = useCurrentUser()
  const { data: users } = useUsers()
  const { createTask, updateTask } = useTaskMutations()

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [assignedDate, setAssignedDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [deadline, setDeadline] = useState('')
  const [priority, setPriority] = useState<Priority>('thuong')
  const [participantIds, setParticipantIds] = useState<string[]>([])
  const [refFiles, setRefFiles] = useState<File[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    if (editing) {
      setTitle(editing.title)
      setDescription(editing.description)
      setAssignedDate(editing.assigned_date)
      setDeadline(format(new Date(editing.deadline), "yyyy-MM-dd'T'HH:mm"))
      setPriority(editing.priority)
      const chuTri = editing.assignees.filter((a) => a.assign_role === 'chu_tri').map((a) => a.user_id)
      const phoiHop = editing.assignees.filter((a) => a.assign_role === 'phoi_hop').map((a) => a.user_id)
      setParticipantIds([...chuTri, ...phoiHop])
    } else {
      setTitle(''); setDescription(''); setPriority('thuong')
      setAssignedDate(format(new Date(), 'yyyy-MM-dd'))
      setDeadline('')
      setParticipantIds([])
    }
    setRefFiles([])
    setError('')
  }, [open, editing])

  const available = useMemo(
    () => (users ?? []).filter((u) => !participantIds.includes(u.id)),
    [users, participantIds],
  )
  const byId = useMemo(() => new Map((users ?? []).map((u) => [u.id, u])), [users])

  const toggleFiles = (list: FileList | null) => {
    if (!list) return
    const files = [...refFiles, ...Array.from(list)].slice(0, 6)
    setRefFiles(files)
  }

  const submit = async () => {
    setError('')
    if (!title.trim()) return setError('Chưa nhập đầu mục công việc.')
    if (!deadline) return setError('Chưa chọn deadline.')
    if (participantIds.length === 0) return setError('Bắt buộc chọn Chủ trì (người được chọn đầu tiên).')
    if (refFiles.length > 0) {
      const err = validateFiles(refFiles)
      if (err) return setError(err)
    }
    const input: TaskInput = {
      title: title.trim(),
      description,
      assigned_date: assignedDate,
      deadline: new Date(deadline).toISOString(),
      priority,
      participantIds,
    }
    setBusy(true)
    try {
      if (editing) {
        await updateTask.mutateAsync({ taskId: editing.id, input })
      } else {
        const taskId = await createTask.mutateAsync({ input, createdBy: user.id })
        if (refFiles.length > 0) await uploadTaskFiles(taskId, refFiles, user.id, true)
      }
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Có lỗi xảy ra, thử lại.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title={editing ? 'Sửa task' : 'Tạo task mới'} width="max-w-2xl">
      <div className="space-y-3">
        <Field label="Đầu mục công việc" required>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ví dụ: FEED" autoFocus />
        </Field>
        <Field label="Mô tả công việc">
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={'1. Làm báo cáo\n2. Làm báo giá\n3. Phạm vi công việc'}
          />
        </Field>

        <div className="grid grid-cols-3 gap-3">
          <Field label="Ngày giao việc" required>
            <Input type="date" value={assignedDate} onChange={(e) => setAssignedDate(e.target.value)} />
          </Field>
          <Field label="Deadline" required>
            <Input type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
          </Field>
          <Field label="Ưu tiên" required>
            <Select value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
              {(Object.keys(PRIORITY_LABEL) as Priority[]).map((p) => (
                <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>
              ))}
            </Select>
          </Field>
        </div>

        {/* Người tham gia: người đầu tiên = Chủ trì */}
        <Field label="Người thực hiện (người chọn ĐẦU TIÊN là Chủ trì)" required>
          <div className="space-y-2">
            {participantIds.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {participantIds.map((id, i) => (
                  <span
                    key={id}
                    className={cn(
                      'inline-flex items-center gap-1 border px-2 py-0.5 text-xs',
                      i === 0 ? 'border-brand-500 bg-brand-50 font-semibold text-brand-700' : 'border-gray-300 bg-gray-100',
                    )}
                  >
                    {i === 0 ? 'Chủ trì: ' : 'Phối hợp: '}
                    {byId.get(id)?.full_name ?? id}
                    <button
                      onClick={() => setParticipantIds(participantIds.filter((x) => x !== id))}
                      className="text-gray-500 hover:text-red-600"
                    >✕</button>
                  </span>
                ))}
              </div>
            )}
            <Select
              value=""
              onChange={(e) => e.target.value && setParticipantIds([...participantIds, e.target.value])}
            >
              <option value="">+ Thêm người tham gia...</option>
              {available.map((u) => (
                <option key={u.id} value={u.id}>{u.full_name} ({u.login_id})</option>
              ))}
            </Select>
            {participantIds.length === 1 && (
              <p className="text-[11px] text-gray-500">Không có phối hợp: Chủ trì tự thực hiện toàn bộ công việc.</p>
            )}
          </div>
        </Field>

        {/* File tham khảo: chỉ khi tạo mới */}
        {!editing && (
          <Field label={`File tham khảo (tối đa 6 file, 50 MB/file) — đã chọn ${refFiles.length}`}>
            <input
              type="file" multiple
              accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.rar"
              onChange={(e) => { toggleFiles(e.target.files); e.target.value = '' }}
              className="block w-full text-xs"
            />
            {refFiles.length > 0 && (
              <ul className="mt-1 space-y-0.5 text-xs text-gray-600">
                {refFiles.map((f, i) => (
                  <li key={i} className="flex items-center gap-2">
                    📎 {f.name}
                    <button onClick={() => setRefFiles(refFiles.filter((_, j) => j !== i))} className="text-red-600">✕</button>
                  </li>
                ))}
              </ul>
            )}
          </Field>
        )}

        {error && <p className="text-xs text-red-600">{error}</p>}

        <div className="flex justify-end gap-2 border-t border-gray-200 pt-3">
          <Button onClick={onClose}>Hủy</Button>
          <Button variant="primary" onClick={submit} disabled={busy}>
            {busy ? 'Đang lưu...' : editing ? 'Lưu thay đổi' : 'Tạo task'}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
