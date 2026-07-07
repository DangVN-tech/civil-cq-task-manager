import { useMemo, useState } from 'react'
import { Button, cardCls, ConfirmDialog, Dialog, Field, Input, Loading, Select, Textarea } from '../components/ui'
import { useProjectMutations, useProjects, type ProjectInput } from '../hooks/useProjects'
import { useAllTasks } from '../hooks/useTasks'
import { cn } from '../lib/utils'
import { PROJECT_STATUS_LABEL, type Project, type ProjectStatus, type TaskGroup } from '../types'

/** Quản lý Dự án / Gói thầu + Nhóm công việc (WBS) — chỉ Trưởng phòng. */
export default function ProjectsPage() {
  const { data: projects, isLoading } = useProjects()
  const { data: allTasks } = useAllTasks()
  const { addProject, updateProject, deleteProject, addGroup, renameGroup, deleteGroup } = useProjectMutations()

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Project | null>(null)
  const [deletingProject, setDeletingProject] = useState<Project | null>(null)
  const [deletingGroup, setDeletingGroup] = useState<TaskGroup | null>(null)
  const [renamingGroup, setRenamingGroup] = useState<TaskGroup | null>(null)
  const [error, setError] = useState('')

  // Đếm số task thực tế (kể cả đã hoàn thành) theo dự án/đầu mục, để cảnh báo khi xóa mạnh tay
  const taskCountByProject = useMemo(() => {
    const map = new Map<string, number>()
    for (const t of allTasks ?? []) {
      const pid = t.group?.project?.id
      if (pid) map.set(pid, (map.get(pid) ?? 0) + 1)
    }
    return map
  }, [allTasks])
  const taskCountByGroup = useMemo(() => {
    const map = new Map<string, number>()
    for (const t of allTasks ?? []) {
      if (t.group_id) map.set(t.group_id, (map.get(t.group_id) ?? 0) + 1)
    }
    return map
  }, [allTasks])

  if (isLoading) return <Loading />

  return (
    <div className="h-full space-y-5 overflow-y-auto p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-950">Quản lý dự án / gói thầu</h2>
        <Button variant="primary" className="rounded-xl" onClick={() => { setEditing(null); setFormOpen(true) }}>
          + Tạo dự án
        </Button>
      </div>

      {error && <p className="text-xs font-semibold text-rose-600">{error}</p>}

      {(projects ?? []).length === 0 && (
        <p className="p-8 text-center text-sm text-slate-400">
          Chưa có dự án nào (chạy migration sẽ tự có dự án "General").
        </p>
      )}

      {(projects ?? []).map((p) => (
        <ProjectCard
          key={p.id}
          project={p}
          onEdit={() => { setEditing(p); setFormOpen(true) }}
          onDelete={() => setDeletingProject(p)}
          onAddGroup={(name) => {
            setError('')
            addGroup.mutate({ projectId: p.id, name }, { onError: (e) => setError(e.message) })
          }}
          onRenameGroup={(g) => setRenamingGroup(g)}
          onDeleteGroup={(g) => setDeletingGroup(g)}
        />
      ))}

      <p className="text-xs text-slate-400">
        Xóa dự án/đầu mục sẽ xóa vĩnh viễn toàn bộ task bên trong (kể cả đã hoàn thành) — không thể khôi phục.
        Dự án "Lưu trữ" sẽ không hiện khi tạo task mới.
      </p>

      <ProjectForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        editing={editing}
        onSubmit={async (input) => {
          if (editing) await updateProject.mutateAsync({ id: editing.id, input })
          else await addProject.mutateAsync(input)
        }}
      />

      <ConfirmDialog
        open={!!deletingProject} onClose={() => setDeletingProject(null)}
        title="Xóa dự án" danger confirmLabel="Xóa"
        message={
          <>
            Xóa dự án <b>{deletingProject?.name}</b>? Toàn bộ{' '}
            <b>{deletingProject?.groups?.length ?? 0} đầu mục</b> và{' '}
            <b>{deletingProject ? taskCountByProject.get(deletingProject.id) ?? 0 : 0} task</b> bên trong
            (kể cả đã hoàn thành) sẽ bị xóa vĩnh viễn, không thể khôi phục.
          </>
        }
        onConfirm={() => {
          setError('')
          if (deletingProject) deleteProject.mutate(deletingProject.id, { onError: (e) => setError(e.message) })
        }}
      />

      <ConfirmDialog
        open={!!deletingGroup} onClose={() => setDeletingGroup(null)}
        title="Xóa đầu mục" danger confirmLabel="Xóa"
        message={
          <>
            Xóa đầu mục <b>{deletingGroup?.name}</b>? Toàn bộ{' '}
            <b>{deletingGroup ? taskCountByGroup.get(deletingGroup.id) ?? 0 : 0} task</b> bên trong
            (kể cả đã hoàn thành) sẽ bị xóa vĩnh viễn, không thể khôi phục.
          </>
        }
        onConfirm={() => {
          setError('')
          if (deletingGroup) deleteGroup.mutate(deletingGroup.id, { onError: (e) => setError(e.message) })
        }}
      />

      <RenameGroupDialog
        group={renamingGroup}
        onClose={() => setRenamingGroup(null)}
        onSubmit={(id, name) => renameGroup.mutate({ id, name })}
      />
    </div>
  )
}

const STATUS_BADGE: Record<ProjectStatus, string> = {
  dang_thuc_hien: 'bg-blue-50 text-blue-700',
  hoan_thanh: 'bg-emerald-50 text-emerald-700',
  luu_tru: 'bg-slate-100 text-slate-500',
}

function ProjectCard({
  project, onEdit, onDelete, onAddGroup, onRenameGroup, onDeleteGroup,
}: {
  project: Project
  onEdit: () => void
  onDelete: () => void
  onAddGroup: (name: string) => void
  onRenameGroup: (g: TaskGroup) => void
  onDeleteGroup: (g: TaskGroup) => void
}) {
  const [newGroup, setNewGroup] = useState('')
  const groups = project.groups ?? []

  const add = () => {
    const name = newGroup.trim()
    if (!name) return
    onAddGroup(name)
    setNewGroup('')
  }

  return (
    <div className={`${cardCls} overflow-hidden`}>
      <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="truncate text-sm font-bold text-slate-900">{project.name}</span>
          <span className={cn('shrink-0 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase', STATUS_BADGE[project.status])}>
            {PROJECT_STATUS_LABEL[project.status]}
          </span>
        </div>
        <div className="shrink-0 space-x-3 text-xs font-medium">
          <button className="text-brand-500 hover:underline" onClick={onEdit}>Sửa</button>
          <button className="text-rose-600 hover:underline" onClick={onDelete}>Xóa</button>
        </div>
      </div>

      {project.description && (
        <p className="border-b border-slate-50 px-4 py-2 text-xs text-slate-500">{project.description}</p>
      )}

      <div className="space-y-1.5 p-4">
        <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
          Đầu mục công việc ({groups.length})
        </h4>
        {groups.map((g) => (
          <div key={g.id} className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/50 px-3 py-1.5">
            <span className="text-sm font-medium text-slate-800">📁 {g.name}</span>
            <span className="space-x-3 text-xs font-medium">
              <button className="text-brand-500 hover:underline" onClick={() => onRenameGroup(g)}>Đổi tên</button>
              <button className="text-rose-600 hover:underline" onClick={() => onDeleteGroup(g)}>Xóa</button>
            </span>
          </div>
        ))}
        <div className="flex gap-2 pt-1">
          <Input
            value={newGroup}
            onChange={(e) => setNewGroup(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
            placeholder="Tên đầu mục mới, ví dụ: Quảng Ninh"
            className="text-xs"
          />
          <Button onClick={add} disabled={!newGroup.trim()}>+ Thêm đầu mục</Button>
        </div>
      </div>
    </div>
  )
}

function ProjectForm({
  open, onClose, editing, onSubmit,
}: {
  open: boolean
  onClose: () => void
  editing: Project | null
  onSubmit: (input: ProjectInput) => Promise<void>
}) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState<ProjectStatus>('dang_thuc_hien')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const [prevOpen, setPrevOpen] = useState(false)
  if (open !== prevOpen) {
    setPrevOpen(open)
    if (open) {
      setName(editing?.name ?? '')
      setDescription(editing?.description ?? '')
      setStatus(editing?.status ?? 'dang_thuc_hien')
      setError('')
    }
  }

  const submit = async () => {
    setError('')
    if (!name.trim()) return setError('Chưa nhập tên dự án.')
    setBusy(true)
    try {
      await onSubmit({ name: name.trim(), description: description.trim(), status })
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Có lỗi xảy ra.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title={editing ? 'Sửa dự án' : 'Tạo dự án / gói thầu'} width="max-w-md">
      <div className="space-y-3">
        <Field label="Tên dự án / gói thầu" required>
          <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Ví dụ: EPC NT3&4" />
        </Field>
        <Field label="Mô tả">
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} className="min-h-16" />
        </Field>
        <Field label="Trạng thái" required>
          <Select value={status} onChange={(e) => setStatus(e.target.value as ProjectStatus)}>
            {(Object.keys(PROJECT_STATUS_LABEL) as ProjectStatus[]).map((s) => (
              <option key={s} value={s}>{PROJECT_STATUS_LABEL[s]}</option>
            ))}
          </Select>
        </Field>
        {error && <p className="text-xs text-rose-600">{error}</p>}
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
          <Button onClick={onClose}>Hủy</Button>
          <Button variant="primary" onClick={submit} disabled={busy}>
            {busy ? 'Đang lưu...' : 'Lưu'}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}

function RenameGroupDialog({
  group, onClose, onSubmit,
}: {
  group: TaskGroup | null
  onClose: () => void
  onSubmit: (id: string, name: string) => void
}) {
  const [name, setName] = useState('')
  const [prev, setPrev] = useState<string | null>(null)
  if ((group?.id ?? null) !== prev) {
    setPrev(group?.id ?? null)
    setName(group?.name ?? '')
  }

  return (
    <Dialog open={!!group} onClose={onClose} title="Đổi tên đầu mục" width="max-w-sm">
      <div className="space-y-3">
        <Input autoFocus value={name} onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && name.trim() && group) { onSubmit(group.id, name.trim()); onClose() } }} />
        <div className="flex justify-end gap-2">
          <Button onClick={onClose}>Hủy</Button>
          <Button variant="primary" disabled={!name.trim()}
            onClick={() => { if (group) { onSubmit(group.id, name.trim()); onClose() } }}>
            Lưu
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
