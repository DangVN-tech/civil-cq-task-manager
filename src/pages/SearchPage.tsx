import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import TaskCard from '../components/task/TaskCard'
import TaskDetail from '../components/task/TaskDetail'
import { Empty, Loading } from '../components/ui'
import { ResizeHandle, useColumnResize } from '../hooks/useColumnResize'
import { useAllTasks } from '../hooks/useTasks'
import type { Task } from '../types'

/** Bỏ dấu tiếng Việt để tìm kiếm dễ trúng hơn. */
function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd')
}

function matches(task: Task, q: string): boolean {
  if (normalize(task.title).includes(q)) return true
  if (normalize(task.description).includes(q)) return true
  if (task.files.some((f) => normalize(f.file_name).includes(q))) return true
  if (task.assignees.some((a) => a.user && normalize(a.user.full_name).includes(q))) return true
  if (task.assignees.some((a) => a.user && normalize(a.user.login_id).includes(q))) return true
  if ((task.external_collabs ?? []).some((n) => normalize(n).includes(q))) return true
  if (task.group && normalize(task.group.name).includes(q)) return true
  if (task.group?.project && normalize(task.group.project.name).includes(q)) return true
  return false
}

export default function SearchPage() {
  const [params, setParams] = useSearchParams()
  const q = normalize(params.get('q') ?? '')
  const selectedId = params.get('task')
  const { data: tasks, isLoading } = useAllTasks()

  const results = useMemo(
    () => (q ? (tasks ?? []).filter((t) => matches(t, q)) : []),
    [tasks, q],
  )
  const selected = results.find((t) => t.id === selectedId) ?? null
  const { width, startDrag } = useColumnResize('ccq-w-list', 400, 300, 640)

  return (
    <div className="flex h-full">
      <div className="flex shrink-0 flex-col border-r border-slate-100 bg-white" style={{ width }}>
        <div className="border-b border-slate-200/80 bg-slate-50 px-4 py-2.5 text-xs text-slate-500">
          Kết quả tìm kiếm cho "{params.get('q')}": <b className="text-slate-800">{results.length}</b> task
        </div>
        <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto p-3">
          {isLoading ? (
            <Loading />
          ) : results.length === 0 ? (
            <Empty label="Không tìm thấy task nào." />
          ) : (
            results.map((t) => (
              <TaskCard key={t.id} task={t} selected={t.id === selectedId}
                onClick={() => setParams({ q: params.get('q') ?? '', task: t.id })} />
            ))
          )}
        </div>
      </div>
      <ResizeHandle onMouseDown={startDrag} />

      <div className="min-w-0 flex-1">
        {selected ? <TaskDetail task={selected} /> : <Empty label="Chọn một task để xem chi tiết." />}
      </div>
    </div>
  )
}
