import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { EyeOff, FolderTree, List, Plus } from 'lucide-react'
import TaskCard from '../components/task/TaskCard'
import TaskDetail from '../components/task/TaskDetail'
import TaskForm from '../components/task/TaskForm'
import TaskTree from '../components/task/TaskTree'
import { EditGroupDialog, EditProjectDialog } from '../components/task/TreeEditDialogs'
import { Button, Empty, FilterAccordion, Loading, Select } from '../components/ui'
import { useCurrentUser } from '../context/AuthContext'
import { ResizeHandle, useColumnResize } from '../hooks/useColumnResize'
import { useHiddenTasks } from '../hooks/useHiddenTasks'
import { useProjects } from '../hooks/useProjects'
import { useTasks } from '../hooks/useTasks'
import { useUsers } from '../hooks/useUsers'
import { canCreateTask, canManageProjects } from '../lib/permissions'
import { cn, sortInProgress } from '../lib/utils'
import { PRIORITY_LABEL, type Priority, type Task } from '../types'

type SortBy = 'default' | 'deadline' | 'title'
type ViewMode = 'list' | 'tree'

export default function InProgressPage() {
  const user = useCurrentUser()
  const { data: tasks, isLoading } = useTasks('dang_thuc_hien')
  // Chỉ để hiện trong Cây (Phẳng vẫn tự ẩn task hoàn thành như cũ)
  const { data: completedTasks } = useTasks('hoan_thanh')
  const { data: projects } = useProjects()
  const { data: users } = useUsers()
  const { hidden: hiddenTaskIds, hide: hideTask, unhideAll } = useHiddenTasks(user.id)
  const [params, setParams] = useSearchParams()
  const selectedId = params.get('task')

  const [createOpen, setCreateOpen] = useState(false)
  const [createGroupId, setCreateGroupId] = useState<string | null>(null)
  // Sửa Dự án / Đầu mục / task ngay trên cây (chỉ Trưởng phòng)
  const [editProjectId, setEditProjectId] = useState<string | null>(null)
  const [editGroupId, setEditGroupId] = useState<string | null>(null)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  // Lọc theo thành viên (Chủ trì hoặc Phối hợp) — rỗng = tất cả
  const [memberId, setMemberId] = useState('')
  const [priority, setPriority] = useState<'' | Priority>('')
  const [sortBy, setSortBy] = useState<SortBy>('default')
  // Bộ lọc WBS: nhận sẵn ?project= khi đi từ Dashboard sang
  const [projectId, setProjectId] = useState(() => params.get('project') ?? '')
  const [groupId, setGroupId] = useState('')
  const [view, setView] = useState<ViewMode>(
    () => (localStorage.getItem('ccq-view-mode') === 'tree' ? 'tree' : 'list'),
  )
  const activeFilterCount = [memberId !== '', priority !== '', sortBy !== 'default', projectId !== '', groupId !== '']
    .filter(Boolean).length

  const setViewMode = (v: ViewMode) => {
    setView(v)
    localStorage.setItem('ccq-view-mode', v)
  }

  const groupOptions = (projects ?? []).find((p) => p.id === projectId)?.groups ?? []
  // Nhân sự thật để chọn lọc (Admin không bao giờ được giao task nên không đưa vào danh sách)
  const memberOptions = (users ?? []).filter((u) => !u.is_admin)

  const list = useMemo(() => {
    let arr = tasks ?? []
    if (memberId) arr = arr.filter((t) => t.assignees.some((a) => a.user_id === memberId))
    if (priority) arr = arr.filter((t) => t.priority === priority)
    if (projectId) arr = arr.filter((t) => t.group?.project?.id === projectId)
    if (groupId) arr = arr.filter((t) => t.group_id === groupId)
    if (sortBy === 'deadline')
      return [...arr].sort((a, b) => (a.deadline ?? '9999').localeCompare(b.deadline ?? '9999'))
    if (sortBy === 'title')
      return [...arr].sort((a, b) => a.title.localeCompare(b.title, 'vi'))
    return sortInProgress(arr) // mặc định: Khẩn -> Gấp -> Quá hạn (Thường) -> Thường
  }, [tasks, memberId, priority, projectId, groupId, sortBy])

  // Task hoàn thành hiện trong Cây: tôn trọng cùng bộ lọc Dự án/Đầu mục/Ưu tiên/Thành viên
  const completedForTree = useMemo(() => {
    let arr = completedTasks ?? []
    if (memberId) arr = arr.filter((t) => t.assignees.some((a) => a.user_id === memberId))
    if (priority) arr = arr.filter((t) => t.priority === priority)
    if (projectId) arr = arr.filter((t) => t.group?.project?.id === projectId)
    if (groupId) arr = arr.filter((t) => t.group_id === groupId)
    return arr
  }, [completedTasks, memberId, priority, projectId, groupId])

  // Cây: gộp đang thực hiện + hoàn thành (hoàn thành xếp sau trong mỗi đầu mục), trừ task đã ẩn tay
  const treeTasksAll = useMemo(() => [...list, ...completedForTree], [list, completedForTree])
  const hiddenCountInView = treeTasksAll.filter((t) => hiddenTaskIds.has(t.id)).length
  const treeTasks = treeTasksAll.filter((t) => !hiddenTaskIds.has(t.id))

  const selected = (tasks ?? []).find((t) => t.id === selectedId)
    ?? (completedTasks ?? []).find((t) => t.id === selectedId)
    ?? null
  const { width, startDrag } = useColumnResize('ccq-w-list', 400, 300, 640)

  // Bộ khung cây: hiện cả dự án/đầu mục rỗng khi KHÔNG lọc theo task (thành viên / ưu tiên).
  // Tôn trọng bộ lọc Dự án/Đầu mục để không phình khi đang lọc.
  const skeleton = useMemo(() => {
    if (memberId || priority !== '') return undefined
    let ps = (projects ?? []).filter((p) => p.status !== 'luu_tru' || p.id === projectId)
    if (projectId) ps = ps.filter((p) => p.id === projectId)
    return ps.map((p) => ({
      ...p,
      groups: (p.groups ?? []).filter((g) => !groupId || g.id === groupId),
    }))
  }, [projects, projectId, groupId, memberId, priority])

  const selectTask = (id: string) => {
    const next = new URLSearchParams(params)
    next.set('task', id)
    setParams(next)
  }

  const clearFilters = () => {
    setMemberId(''); setPriority(''); setSortBy('default')
    setProjectId(''); setGroupId('')
    const next = new URLSearchParams(params)
    next.delete('project')
    setParams(next)
  }

  return (
    <div className="flex h-full">
      {/* ===== Cột danh sách ===== */}
      <div className="flex shrink-0 flex-col border-r border-slate-100 bg-white" style={{ width }}>
        {/* Hàng gộp: nút Tạo Dự án + chuyển chế độ xem — tiết kiệm chiều cao */}
        <div className="flex items-center gap-2 border-b border-slate-100 p-3">
          {canCreateTask(user) && (
            <Button variant="primary" className="flex-1 justify-center rounded-xl"
              onClick={() => { setCreateGroupId(null); setCreateOpen(true) }}>
              <Plus size={14} /> Dự án mới
            </Button>
          )}
          <div className="flex shrink-0 rounded-xl bg-slate-200/65 p-1">
            <button
              onClick={() => setViewMode('tree')}
              title="Xem theo cây"
              className={cn('flex items-center gap-1 rounded-lg px-2 py-1.5 text-[10px] font-bold transition-all',
                view === 'tree' ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500 hover:text-slate-800')}
            >
              <FolderTree size={13} /> Cây
            </button>
            <button
              onClick={() => setViewMode('list')}
              title="Xem danh sách"
              className={cn('flex items-center gap-1 rounded-lg px-2 py-1.5 text-[10px] font-bold transition-all',
                view === 'list' ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500 hover:text-slate-800')}
            >
              <List size={13} /> Phẳng
            </button>
          </div>
        </div>

        {/* Bộ lọc nâng cao: thu gọn mặc định */}
        <FilterAccordion activeCount={activeFilterCount} onReset={clearFilters}>
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
          <div className="grid grid-cols-2 gap-1.5">
            <Select value={priority} onChange={(e) => setPriority(e.target.value as '' | Priority)} className="py-1 text-xs">
              <option value="">Ưu tiên: tất cả</option>
              {(Object.keys(PRIORITY_LABEL) as Priority[]).map((p) => (
                <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>
              ))}
            </Select>
            <Select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortBy)} className="py-1 text-xs">
              <option value="default">Sắp xếp: mặc định</option>
              <option value="deadline">Theo deadline</option>
              <option value="title">Theo tên task</option>
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-[9px] font-bold uppercase text-slate-400">
              Lọc theo thành viên (Chủ trì / Phối hợp)
            </label>
            <Select value={memberId} onChange={(e) => setMemberId(e.target.value)} className="py-1 text-xs">
              <option value="">Thành viên: tất cả</option>
              {memberOptions.map((u) => (
                <option key={u.id} value={u.id}>{u.id === user.id ? `${u.full_name} (Tôi)` : u.full_name}</option>
              ))}
            </Select>
          </div>
        </FilterAccordion>

        {view === 'tree' && hiddenCountInView > 0 && (
          <button
            onClick={unhideAll}
            className="flex items-center justify-center gap-1.5 border-b border-slate-100 bg-slate-50 py-1.5 text-[11px] font-bold text-slate-500 hover:bg-slate-100 hover:text-brand-600"
          >
            <EyeOff size={11} /> {hiddenCountInView} task đã ẩn · Hiện lại
          </button>
        )}

        <div className={cn('min-h-0 flex-1 overflow-y-auto', view === 'list' && 'space-y-2.5 p-3')}>
          {isLoading ? (
            <Loading />
          ) : view === 'tree' ? (
            <TaskTree
              tasks={treeTasks}
              selectedId={selectedId}
              onSelect={selectTask}
              onAddTask={canCreateTask(user)
                ? (gid) => { setCreateGroupId(gid); setCreateOpen(true) }
                : undefined}
              onEditProject={canManageProjects(user) ? setEditProjectId : undefined}
              onEditGroup={canManageProjects(user) ? setEditGroupId : undefined}
              onHide={hideTask}
              skeleton={skeleton}
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
