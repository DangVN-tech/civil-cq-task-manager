import { useEffect, useMemo, useState } from 'react'
import { format } from 'date-fns'
import { useDropzone } from 'react-dropzone'
import { useCurrentUser } from '../../context/AuthContext'
import { useProjects } from '../../hooks/useProjects'
import { useUsers } from '../../hooks/useUsers'
import { useTaskMutations, type TaskInput } from '../../hooks/useTasks'
import { uploadTaskFiles, validateFiles } from '../../lib/files'
import { cn } from '../../lib/utils'
import { PRIORITY_LABEL, type Priority, type Project, type Task } from '../../types'
import { Button, Dialog, Field, Input, Select, Textarea } from '../ui'

/** Form tạo / sửa task — chỉ Trưởng phòng.
 *  initialGroupId: mở form từ nút ➕ trên Cây thư mục -> điền sẵn vị trí đó. */
export default function TaskForm({
  open,
  onClose,
  editing,
  initialGroupId,
}: {
  open: boolean
  onClose: () => void
  editing?: Task | null
  initialGroupId?: string | null
}) {
  const user = useCurrentUser()
  const { data: users } = useUsers()
  const { data: projects } = useProjects()
  const { createTask, updateTask } = useTaskMutations()

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [assignedDate, setAssignedDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [deadline, setDeadline] = useState('')
  const [priority, setPriority] = useState<Priority>('thuong')
  const [groupId, setGroupId] = useState('')
  const [participantIds, setParticipantIds] = useState<string[]>([])
  const [externals, setExternals] = useState<string[]>([])
  const [externalInput, setExternalInput] = useState('')
  const [refFiles, setRefFiles] = useState<File[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    if (editing) {
      setTitle(editing.title)
      setDescription(editing.description)
      setAssignedDate(editing.assigned_date)
      setDeadline(editing.deadline ? format(new Date(editing.deadline), "yyyy-MM-dd'T'HH:mm") : '')
      setPriority(editing.priority)
      const chuTri = editing.assignees.filter((a) => a.assign_role === 'chu_tri').map((a) => a.user_id)
      const phoiHop = editing.assignees.filter((a) => a.assign_role === 'phoi_hop').map((a) => a.user_id)
      setParticipantIds([...chuTri, ...phoiHop])
      setExternals(editing.external_collabs ?? [])
      setGroupId(editing.group_id ?? '')
    } else {
      setTitle(''); setDescription(''); setPriority('thuong')
      setAssignedDate(format(new Date(), 'yyyy-MM-dd'))
      setDeadline('')
      setParticipantIds([])
      setExternals([])
      setGroupId('')
    }
    setExternalInput('')
    setRefFiles([])
    setError('')
  }, [open, editing])

  // Vị trí mặc định khi tạo mới: nhóm được bấm ➕ trên cây, nếu không thì General
  useEffect(() => {
    if (!open || editing || groupId || !projects || projects.length === 0) return
    if (initialGroupId && projects.some((p) => p.groups?.some((g) => g.id === initialGroupId))) {
      setGroupId(initialGroupId)
      return
    }
    const general = projects.find((p) => p.name === 'General') ?? projects[0]
    setGroupId(general.groups?.[0]?.id ?? '')
  }, [open, editing, groupId, initialGroupId, projects])

  // Admin hệ thống không tham gia thực hiện task
  const available = useMemo(
    () => (users ?? []).filter((u) => !u.is_admin && !participantIds.includes(u.id)),
    [users, participantIds],
  )
  const byId = useMemo(() => new Map((users ?? []).map((u) => [u.id, u])), [users])

  // Khung upload file tham khảo: kéo thả hoặc bấm để chọn
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (accepted) => setRefFiles((prev) => [...prev, ...accepted].slice(0, 6)),
    disabled: !!editing,
  })

  const addExternal = () => {
    const name = externalInput.trim()
    if (!name) return
    if (!externals.includes(name)) setExternals([...externals, name])
    setExternalInput('')
  }

  const submit = async () => {
    setError('')
    if (!title.trim()) return setError('Chưa nhập đầu mục công việc.')
    if (!groupId) return setError('Chưa chọn vị trí trong cây dự án (tạo nhóm trong "Quản lý dự án" nếu dự án chưa có nhóm).')
    if (participantIds.length === 0) return setError('Bắt buộc chọn Chủ trì.')
    if (refFiles.length > 0) {
      const err = validateFiles(refFiles)
      if (err) return setError(err)
    }
    const input: TaskInput = {
      title: title.trim(),
      description,
      assigned_date: assignedDate,
      // Không chọn deadline = công việc thường xuyên, không có hạn hoàn thành
      deadline: deadline ? new Date(deadline).toISOString() : null,
      priority,
      participantIds,
      externalCollabs: externals,
      groupId,
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

        {/* WBS: chọn vị trí bằng cây thư mục Dự án -> Nhóm */}
        <Field label="Vị trí trong cây dự án" required>
          <GroupPicker projects={projects ?? []} groupId={groupId} onPick={setGroupId} />
        </Field>

        <div className="grid grid-cols-3 gap-3">
          <Field label="Ngày giao việc" required>
            <Input type="date" value={assignedDate} onChange={(e) => setAssignedDate(e.target.value)} />
          </Field>
          <Field label="Deadline">
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

        {/* Người tham gia: người đầu tiên = Chủ trì (thẻ tên tự hiện nhãn) */}
        <Field label="Người thực hiện" required>
          <div className="space-y-2">
            {participantIds.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {participantIds.map((id, i) => (
                  <span
                    key={id}
                    className={cn(
                      'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs',
                      i === 0 ? 'border-brand-500 bg-brand-50 font-semibold text-brand-700' : 'border-slate-300 bg-slate-100',
                    )}
                  >
                    {i === 0 ? 'Chủ trì: ' : 'Phối hợp: '}
                    {byId.get(id)?.full_name ?? id}
                    <button
                      onClick={() => setParticipantIds(participantIds.filter((x) => x !== id))}
                      className="text-slate-500 hover:text-rose-600"
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
            {participantIds.length === 1 && externals.length === 0 && (
              <p className="text-[11px] text-slate-500">Không có phối hợp: Chủ trì tự thực hiện toàn bộ công việc.</p>
            )}
          </div>
        </Field>

        {/* Phối hợp ngoài phòng: nhập tự do, chỉ để thành viên biết cần phối hợp với ai */}
        <Field label="Ai đó khác... (phối hợp ngoài phòng, nhập tự do)">
          <div className="space-y-2">
            {externals.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {externals.map((name) => (
                  <span key={name}
                    className="inline-flex items-center gap-1 rounded-md border border-dashed border-slate-300 bg-slate-50 px-2 py-0.5 text-xs text-slate-600">
                    Phối hợp (ngoài): {name}
                    <button onClick={() => setExternals(externals.filter((x) => x !== name))}
                      className="text-slate-400 hover:text-rose-600">✕</button>
                  </span>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <Input
                value={externalInput}
                onChange={(e) => setExternalInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addExternal() } }}
                placeholder="Ví dụ: Phòng Kế toán - anh Nam"
              />
              <Button type="button" onClick={addExternal} disabled={!externalInput.trim()}>+ Thêm</Button>
            </div>
            <p className="text-[11px] text-slate-400">
              Người ngoài phòng không có tài khoản — chỉ hiển thị để thành viên biết cần phối hợp với ai.
            </p>
          </div>
        </Field>

        {/* File tham khảo: chỉ khi tạo mới — khung kéo thả nổi bật */}
        {!editing && (
          <Field label={`File tham khảo — đã chọn ${refFiles.length}/6`}>
            <div
              {...getRootProps()}
              className={cn(
                'cursor-pointer rounded-xl border-2 border-dashed p-5 text-center transition-colors',
                isDragActive
                  ? 'border-brand-500 bg-brand-50'
                  : 'border-slate-300 bg-slate-50/50 hover:border-brand-400 hover:bg-brand-50/40',
              )}
            >
              <input {...getInputProps()} accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.rar" />
              <div className="text-2xl">📎</div>
              <p className="mt-1 text-xs font-semibold text-slate-700">
                Kéo thả file vào đây hoặc <span className="text-brand-500 underline">bấm để chọn file</span>
              </p>
              <p className="mt-0.5 text-[10px] text-slate-400">
                Tối đa 6 file · 50 MB/file · pdf, doc, xls, ppt, zip, rar
              </p>
            </div>
            {refFiles.length > 0 && (
              <ul className="mt-2 space-y-1 text-xs text-slate-600">
                {refFiles.map((f, i) => (
                  <li key={i} className="flex items-center gap-2 rounded-md border border-slate-100 bg-white px-2 py-1">
                    📎 <span className="min-w-0 flex-1 truncate">{f.name}</span>
                    <button onClick={() => setRefFiles(refFiles.filter((_, j) => j !== i))}
                      className="text-slate-400 hover:text-rose-600">✕</button>
                  </li>
                ))}
              </ul>
            )}
          </Field>
        )}

        {error && <p className="text-xs text-rose-600">{error}</p>}

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
          <Button onClick={onClose}>Hủy</Button>
          <Button variant="primary" onClick={submit} disabled={busy}>
            {busy ? 'Đang lưu...' : editing ? 'Lưu thay đổi' : 'Tạo task'}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}

/** Cây chọn vị trí: ▼ Dự án -> 📁 Nhóm công việc. Bấm nhóm để chọn. */
function GroupPicker({
  projects,
  groupId,
  onPick,
}: {
  projects: Project[]
  groupId: string
  onPick: (groupId: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [collapsedProjects, setCollapsedProjects] = useState<Set<string>>(new Set())

  // Bỏ dự án Lưu trữ, trừ khi vị trí hiện tại của task nằm trong đó
  const visible = projects.filter(
    (p) => p.status !== 'luu_tru' || p.groups?.some((g) => g.id === groupId),
  )

  let currentPath = ''
  for (const p of visible) {
    const g = p.groups?.find((x) => x.id === groupId)
    if (g) { currentPath = `${p.name} › ${g.name}`; break }
  }

  const toggleProject = (id: string) => {
    setCollapsedProjects((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      {/* Dòng hiển thị vị trí đang chọn — bấm để mở/đóng cây */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-slate-50"
      >
        <span className={cn('min-w-0 truncate', currentPath ? 'font-semibold text-slate-800' : 'text-slate-400')}>
          🗂 {currentPath || 'Bấm để chọn Dự án › Nhóm công việc...'}
        </span>
        <span className="shrink-0 text-xs text-slate-400">{expanded ? '▲ thu gọn' : '▼ chọn vị trí'}</span>
      </button>

      {expanded && (
        <div className="max-h-52 overflow-y-auto border-t border-slate-100 p-1.5">
          {visible.length === 0 && (
            <p className="p-2 text-xs text-slate-400">Chưa có dự án nào — tạo trong "Quản lý dự án".</p>
          )}
          {visible.map((p) => {
            const pOpen = !collapsedProjects.has(p.id)
            return (
              <div key={p.id}>
                <button
                  type="button"
                  onClick={() => toggleProject(p.id)}
                  className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-sm font-bold text-slate-900 hover:bg-slate-50"
                >
                  <span className="w-3 text-[10px] text-slate-400">{pOpen ? '▼' : '▶'}</span>
                  <span className="min-w-0 flex-1 truncate">{p.name}</span>
                </button>
                {pOpen && (
                  <div className="ml-5">
                    {(p.groups ?? []).length === 0 && (
                      <p className="px-2 py-1 text-[11px] italic text-slate-400">(chưa có nhóm công việc)</p>
                    )}
                    {(p.groups ?? []).map((g) => (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => { onPick(g.id); setExpanded(false) }}
                        className={cn(
                          'flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-[13px] transition-colors',
                          g.id === groupId
                            ? 'bg-brand-50 font-semibold text-brand-700'
                            : 'text-slate-700 hover:bg-slate-50',
                        )}
                      >
                        📁 <span className="min-w-0 flex-1 truncate">{g.name}</span>
                        {g.id === groupId && <span className="shrink-0 text-brand-500">✓</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
