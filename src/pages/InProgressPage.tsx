import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import TaskCard from '../components/task/TaskCard'
import TaskDetail from '../components/task/TaskDetail'
import TaskForm from '../components/task/TaskForm'
import TaskTree from '../components/task/TaskTree'
import { EditGroupDialog, EditProjectDialog } from '../components/task/TreeEditDialogs'
import { Button, Empty, Loading, Select } from '../components/ui'
import { useCurrentUser } from '../context/AuthContext'
import { ResizeHandle, useColumnResize } from '../hooks/useColumnResize'
import { useProjects } from '../hooks/useProjects'
import { useTasks } from '../hooks/useTasks'
import { canCreateTask, canManageProjects, isParticipant } from '../lib/permissions'
import { cn, sortInProgress } from '../lib/utils'
import { PRIORITY_LABEL, type Priority, type Task } from '../types'

type SortBy = 'default' | 'deadline' | 'title'
type ViewMode = 'list' | 'tree'

export default function InProgressPage() {
  const user = useCurrentUser()
  const { data: tasks, isLoading } = useTasks('dang_thuc_hien')
  const { data: projects } = useProjects()
  const [params, setParams] = useSearchParams()
  const selectedId = params.get('task')

  const [createOpen, setCreateOpen] = useState(false)
  const [createGroupId, setCreateGroupId] = useState<string | null>(null)
  // Sửa Dự án / Đầu mục / task ngay trên cây (chỉ Trưởng phòng)
  const [editProjectId, setEditProjectId] = useState<string | null>(null)
  const [editGroupId, setEditGroupId] = useState<string | null>(null)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [myOnly, setMyOnly] = useState(false)
  const [priority, setPriority] = useState<'' | Priority>('')
  const [sortBy, setSortBy] = useState<SortBy>('default')
  // Bộ lọc WBS: nhận sẵn ?project= khi đi từ Dashboard sang
  const [projectId, setProjectId] = useState(() => params.get('project') ?? '')
  const [groupId, setGroupId] = useState('')
  const [view, setView] = useState<ViewMode>(
    () => (localStorage.getItem('ccq-view-mode') === 'tree' ? 'tree' : 'list'),
  )
  const filtering = myOnly || priority !== '' || sortBy !== 'default' || projectId !== '' || groupId !== ''

  const setViewMode = (v: ViewMode) => {
    setView(v)
    localStorage.setItem('ccq-view-mode', v)
  }

  const groupOptions = (projects ?? []).find((p) => p.id === projectId)?.groups ?? []

  const list = useMemo(() => {
    let arr = tasks ?? []
    if (myOnly) arr = arr.filter((t) => isParticipant(t, user))
    if (priority) arr = arr.filter((t) => t.priority === priority)
    if (projectId) arr = arr.filter((t) => t.group?.project?.id === projectId)
    if (groupId) arr = arr.filter((t) => t.group_id === groupId)
    if (sortBy === 'deadline')
      return [...arr].sort((a, b) => (a.deadline ?? '9999').localeCompare(b.deadline ?? '9999'))
    if (sortBy === 'title')
      return [...arr].sort((a, b) => a.title.localeCompare(b.title, 'vi'))
    return sortInProgress(arr) // mặc định: Khẩn -> Gấp -> Quá hạn (Thường) -> Thường
  }, [tasks, myOnly, priority, projectId, groupId, sortBy, user])

  const selected = (tasks ?? []).find((t) => t.id === selectedId) ?? null
  const { width, startDrag } = useColumnResize('ccq-w-list', 400, 300, 640)

  const selectTask = (id: string) => {
    const next = new URLSearchParams(params)
    next.set('task', id)
    setParams(next)
  }

  const clearFilters = () => {
    setMyOnly(false); setPriority(''); setSortBy('default')
    setProjectId(''); setGroupId('')
    const next = new URLSearchParams(params)
    next.delete('project')
    setParams(next)
  }

  return (
    <div className="flex h-full">
      {/* ===== Cột danh sách ===== */}
      <div className="flex shrink-0 flex-col border-r border-slate-100 bg-white" style={{ width }}>
        <div className="space-y-2 border-b border-slate-100 bg-slate-50/50 p-3">
          {canCreateTask(user) && (
            <Button variant="primary" className="w-full justify-center rounded-xl"
              onClick={() => { setCreateGroupId(null); setCreateOpen(true) }}>
              + Tạo Dự án
            </Button>
          )}

          {/* Chuyển chế độ xem: Danh sách | Cây thư mục */}
          <div className="flex overflow-hidden rounded-lg border border-slate-200 bg-white text-xs font-medium">
            <button
              onClick={() => setViewMode('list')}
              className={cn('flex-1 px-2 py-1.5 transition-colors',
                view === 'list' ? 'bg-brand-500 text-white' : 'text-slate-600 hover:bg-slate-50')}
            >
              ☰ Danh sách
            </button>
            <button
              onClick={() => setViewMode('tree')}
              className={cn('flex-1 px-2 py-1.5 transition-colors',
                view === 'tree' ? 'bg-brand-500 text-white' : 'text-slate-600 hover:bg-slate-50')}
            >
              🗂 Cây thư mục
            </button>
          </div>

          {/* Bộ lọc WBS */}
          <div className="grid grid-cols-2 gap-1.5">
            <Select
              value={projectId}
              onChange={(e) => { setProjectId(e.target.value); setGroupId('') }}
              className="py-1 text-xs"
            >
              <option value="">Dự án: tất cả</option>
              {(projects ?? []).map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </Select>
            <Select
              value={groupId}
              onChange={(e) => setGroupId(e.target.value)}
              className="py-1 text-xs"
              disabled={!projectId}
            >
              <option value="">Đầu mục: tất cả</option>
              {groupOptions.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </Select>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <Button
              variant="ghost"
              className={cn('px-2 py-1 text-xs', myOnly && 'bg-brand-100 font-semibold text-brand-700')}
              onClick={() => setMyOnly(!myOnly)}
            >
              Task của tôi
            </Button>
            <Select value={priority} onChange={(e) => setPriority(e.target.value as '' | Priority)} className="w-auto py-1 text-xs">
              <option value="">Ưu tiên: tất cả</option>
              {(Object.keys(PRIORITY_LABEL) as Priority[]).map((p) => (
                <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>
              ))}
            </Select>
            <Select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortBy)} className="w-auto py-1 text-xs">
              <option value="default">Sắp xếp: mặc định</option>
              <option value="deadline">Theo deadline</option>
              <option value="title">Theo tên task</option>
            </Select>
            {filtering && (
              <Button variant="ghost" className="px-2 py-1 text-xs text-rose-600" onClick={clearFilters}>
                Tắt lọc
              </Button>
            )}
          </div>
        </div>

        <div className={cn('min-h-0 flex-1 overflow-y-auto', view === 'list' && 'space-y-2.5 p-3')}>
          {isLoading ? (
            <Loading />
          ) : view === 'tree' ? (
            <TaskTree
              tasks={list}
              selectedId={selectedId}
              onSelect={selectTask}
              onAddTask={canCreateTask(user)
                ? (gid) => { setCreateGroupId(gid); setCreateOpen(true) }
                : undefined}
              onEditProject={canManageProjects(user) ? setEditProjectId : undefined}
              onEditGroup={canManageProjects(user) ? setEditGroupId : undefined}
            />
          ) : list.length === 0 ? (
            <Empty label="Không có task nào." />
          ) : (
            list.map((t) => (
              <TaskCard key={t.id} task={t} selected={t.id === selectedId}
                onClick={() => selectTask(t.id)} />
            ))
          )}
        </div>
      </div>

      {/* Thanh nắm kéo chỉnh độ rộng */}
      <ResizeHandle onMouseDown={startDrag} />

      {/* ===== Cột chi tiết ===== */}
      <div className="min-w-0 flex-1">
        {selected ? (
          <TaskDetail task={selected} />
        ) : (
          <Empty label="Chọn một task để xem chi tiết." />
        )}
      </div>

      <TaskForm
        open={createOpen}
        onClose={() => { setCreateOpen(false); setCreateGroupId(null) }}
        initialGroupId={createGroupId}
      />

      {/* Sửa task mở từ dialog Sửa Đầu mục */}
      <TaskForm open={!!editingTask} onClose={() => setEditingTask(null)} editing={editingTask} />

      <EditProjectDialog projectId={editProjectId} onClose={() => setEditProjectId(null)} />
      <EditGroupDialog
        groupId={editGroupId}
        onClose={() => setEditGroupId(null)}
        onEditTask={setEditingTask}
        onAddTask={(gid) => { setCreateGroupId(gid); setCreateOpen(true) }}
      />
    </div>
  )
}
