import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import TaskCard from '../components/task/TaskCard'
import TaskDetail from '../components/task/TaskDetail'
import TaskForm from '../components/task/TaskForm'
import { Button, Empty, Loading, Select } from '../components/ui'
import { useCurrentUser } from '../context/AuthContext'
import { ResizeHandle, useColumnResize } from '../hooks/useColumnResize'
import { useTasks } from '../hooks/useTasks'
import { canCreateTask, isParticipant } from '../lib/permissions'
import { cn, sortInProgress } from '../lib/utils'
import { PRIORITY_LABEL, type Priority } from '../types'

type SortBy = 'default' | 'deadline' | 'title'

export default function InProgressPage() {
  const user = useCurrentUser()
  const { data: tasks, isLoading } = useTasks('dang_thuc_hien')
  const [params, setParams] = useSearchParams()
  const selectedId = params.get('task')

  const [createOpen, setCreateOpen] = useState(false)
  const [myOnly, setMyOnly] = useState(false)
  const [priority, setPriority] = useState<'' | Priority>('')
  const [sortBy, setSortBy] = useState<SortBy>('default')
  const filtering = myOnly || priority !== '' || sortBy !== 'default'

  const list = useMemo(() => {
    let arr = tasks ?? []
    if (myOnly) arr = arr.filter((t) => isParticipant(t, user))
    if (priority) arr = arr.filter((t) => t.priority === priority)
    if (sortBy === 'deadline')
      return [...arr].sort((a, b) => (a.deadline ?? '9999').localeCompare(b.deadline ?? '9999'))
    if (sortBy === 'title')
      return [...arr].sort((a, b) => a.title.localeCompare(b.title, 'vi'))
    return sortInProgress(arr) // mặc định: Khẩn -> Gấp -> Quá hạn (Thường) -> Thường
  }, [tasks, myOnly, priority, sortBy, user])

  const selected = (tasks ?? []).find((t) => t.id === selectedId) ?? null
  const { width, startDrag } = useColumnResize('ccq-w-list', 400, 300, 640)

  return (
    <div className="flex h-full">
      {/* ===== Cột danh sách ===== */}
      <div className="flex shrink-0 flex-col border-r border-slate-100 bg-white" style={{ width }}>
        <div className="space-y-2 border-b border-slate-100 bg-slate-50/50 p-3">
          {canCreateTask(user) && (
            <Button variant="primary" className="w-full justify-center" onClick={() => setCreateOpen(true)}>
              + Tạo task
            </Button>
          )}
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
              <option value="title">Theo đầu mục</option>
            </Select>
            {filtering && (
              <Button variant="ghost" className="px-2 py-1 text-xs text-red-600"
                onClick={() => { setMyOnly(false); setPriority(''); setSortBy('default') }}>
                Tắt lọc
              </Button>
            )}
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto p-3">
          {isLoading ? (
            <Loading />
          ) : list.length === 0 ? (
            <Empty label="Không có task nào." />
          ) : (
            list.map((t) => (
              <TaskCard key={t.id} task={t} selected={t.id === selectedId}
                onClick={() => setParams({ task: t.id })} />
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

      <TaskForm open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  )
}
