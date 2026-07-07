import { useEffect, useState } from 'react'
import { useProjectMutations, useProjects } from '../../hooks/useProjects'
import { useAllTasks, useTaskMutations } from '../../hooks/useTasks'
import { PRIORITY_LABEL, type Task } from '../../types'
import { Button, ConfirmDialog, Dialog, Field, Input } from '../ui'

/** Sửa Dự án (mở từ nút ✏️ trên cây): đổi tên dự án + thêm/xóa/đổi tên Đầu mục. */
export function EditProjectDialog({
  projectId,
  onClose,
}: {
  projectId: string | null
  onClose: () => void
}) {
  const { data: projects } = useProjects()
  const { data: allTasks } = useAllTasks()
  const { updateProject, addGroup, renameGroup, deleteGroup } = useProjectMutations()
  const project = (projects ?? []).find((p) => p.id === projectId) ?? null

  const [name, setName] = useState('')
  const [newGroup, setNewGroup] = useState('')
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [deletingGroupId, setDeletingGroupId] = useState<string | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (projectId && project) {
      setName(project.name)
      setNewGroup('')
      setRenamingId(null)
      setError('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId])

  if (!project) return null
  const deletingGroup = project.groups?.find((g) => g.id === deletingGroupId)

  const saveName = () => {
    const v = name.trim()
    if (!v || v === project.name) return
    updateProject.mutate(
      { id: project.id, input: { name: v, description: project.description, status: project.status } },
      { onError: (e) => setError(e.message) },
    )
  }

  return (
    <Dialog open={!!projectId} onClose={onClose} title="Sửa Dự án" width="max-w-md">
      <div className="space-y-4">
        <Field label="Tên Dự án" required>
          <div className="flex gap-2">
            <Input value={name} onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && saveName()} />
            <Button onClick={saveName} disabled={!name.trim() || name.trim() === project.name}>
              Đổi tên
            </Button>
          </div>
        </Field>

        <Field label={`Đầu mục công việc (${project.groups?.length ?? 0})`}>
          <div className="space-y-1.5">
            {(project.groups ?? []).map((g) =>
              renamingId === g.id ? (
                <div key={g.id} className="flex gap-2">
                  <Input autoFocus value={renameValue} onChange={(e) => setRenameValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && renameValue.trim()) {
                        renameGroup.mutate({ id: g.id, name: renameValue.trim() })
                        setRenamingId(null)
                      }
                    }} />
                  <Button variant="primary" disabled={!renameValue.trim()}
                    onClick={() => { renameGroup.mutate({ id: g.id, name: renameValue.trim() }); setRenamingId(null) }}>
                    Lưu
                  </Button>
                  <Button onClick={() => setRenamingId(null)}>Hủy</Button>
                </div>
              ) : (
                <div key={g.id}
                  className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/50 px-3 py-1.5">
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800">📁 {g.name}</span>
                  <span className="shrink-0 space-x-3 text-xs font-medium">
                    <button className="text-brand-500 hover:underline"
                      onClick={() => { setRenamingId(g.id); setRenameValue(g.name) }}>
                      Đổi tên
                    </button>
                    <button className="text-rose-600 hover:underline" onClick={() => setDeletingGroupId(g.id)}>
                      Xóa
                    </button>
                  </span>
                </div>
              ),
            )}
            <div className="flex gap-2 pt-1">
              <Input value={newGroup} onChange={(e) => setNewGroup(e.target.value)}
                placeholder="Tên đầu mục mới, ví dụ: Quảng Ninh"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newGroup.trim()) {
                    addGroup.mutate({ projectId: project.id, name: newGroup.trim() })
                    setNewGroup('')
                  }
                }} />
              <Button disabled={!newGroup.trim()}
                onClick={() => { addGroup.mutate({ projectId: project.id, name: newGroup.trim() }); setNewGroup('') }}>
                + Thêm
              </Button>
            </div>
          </div>
        </Field>

        {error && <p className="text-xs text-rose-600">{error}</p>}

        <div className="flex justify-end border-t border-slate-100 pt-3">
          <Button variant="primary" onClick={onClose}>Xong</Button>
        </div>
      </div>

      <ConfirmDialog
        open={!!deletingGroupId} onClose={() => setDeletingGroupId(null)}
        title="Xóa đầu mục" danger confirmLabel="Xóa"
        message={
          <>
            Xóa đầu mục <b>{deletingGroup?.name}</b>? Toàn bộ{' '}
            <b>{(allTasks ?? []).filter((t) => t.group_id === deletingGroupId).length} task</b> bên trong
            (kể cả đã hoàn thành) sẽ bị xóa vĩnh viễn, không thể khôi phục.
          </>
        }
        onConfirm={() => {
          setError('')
          if (deletingGroupId) deleteGroup.mutate(deletingGroupId, { onError: (e) => setError(e.message) })
        }}
      />
    </Dialog>
  )
}

/** Sửa Đầu mục (mở từ nút ✏️ trên cây): đổi tên + thêm/sửa/xóa các task bên trong. */
export function EditGroupDialog({
  groupId,
  onClose,
  onEditTask,
  onAddTask,
}: {
  groupId: string | null
  onClose: () => void
  onEditTask: (task: Task) => void
  onAddTask: (groupId: string) => void
}) {
  const { data: projects } = useProjects()
  const { renameGroup } = useProjectMutations()
  const { deleteTask } = useTaskMutations()
  const { data: allTasks } = useAllTasks()

  let group = null
  let projectName = ''
  for (const p of projects ?? []) {
    const g = p.groups?.find((x) => x.id === groupId)
    if (g) { group = g; projectName = p.name; break }
  }

  const [name, setName] = useState('')
  const [deletingTask, setDeletingTask] = useState<Task | null>(null)

  useEffect(() => {
    if (groupId && group) setName(group.name)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId])

  if (!group) return null
  const tasks = (allTasks ?? []).filter((t) => t.group_id === groupId)

  const saveName = () => {
    const v = name.trim()
    if (!v || v === group!.name) return
    renameGroup.mutate({ id: group!.id, name: v })
  }

  return (
    <Dialog open={!!groupId} onClose={onClose} title={`Sửa Đầu mục — ${projectName}`} width="max-w-md">
      <div className="space-y-4">
        <Field label="Tên Đầu mục" required>
          <div className="flex gap-2">
            <Input value={name} onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && saveName()} />
            <Button onClick={saveName} disabled={!name.trim() || name.trim() === group.name}>
              Đổi tên
            </Button>
          </div>
        </Field>

        <Field label={`Task phải làm (${tasks.length})`}>
          <div className="space-y-1.5">
            {tasks.length === 0 && <p className="text-xs italic text-slate-400">Chưa có task nào.</p>}
            {tasks.map((t) => (
              <div key={t.id}
                className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/50 px-3 py-1.5">
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800">
                  {t.title}
                  <span className="ml-1.5 text-[10px] text-slate-400">
                    {t.status === 'hoan_thanh' ? '✓ hoàn thành' : `${PRIORITY_LABEL[t.priority]} · ${t.progress}%`}
                  </span>
                </span>
                <span className="shrink-0 space-x-3 text-xs font-medium">
                  <button className="text-brand-500 hover:underline"
                    onClick={() => { onEditTask(t); onClose() }}>
                    Sửa
                  </button>
                  <button className="text-rose-600 hover:underline" onClick={() => setDeletingTask(t)}>
                    Xóa
                  </button>
                </span>
              </div>
            ))}
            <Button className="w-full justify-center" onClick={() => { onAddTask(group!.id); onClose() }}>
              + Thêm task vào đầu mục này
            </Button>
          </div>
        </Field>

        <div className="flex justify-end border-t border-slate-100 pt-3">
          <Button variant="primary" onClick={onClose}>Xong</Button>
        </div>
      </div>

      <ConfirmDialog
        open={!!deletingTask} onClose={() => setDeletingTask(null)}
        title="Xóa task" danger confirmLabel="Xóa"
        message={<>Xóa vĩnh viễn task <b>{deletingTask?.title}</b> cùng toàn bộ file, nhật ký? Không thể hoàn tác.</>}
        onConfirm={() => deletingTask && deleteTask.mutate(deletingTask.id)}
      />
    </Dialog>
  )
}
