import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import TaskCard from '../components/task/TaskCard'
import TaskDetail from '../components/task/TaskDetail'
import { Empty, Loading } from '../components/ui'
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

  return (
    <div className="flex h-full">
      <div className="flex w-[400px] shrink-0 flex-col border-r border-gray-300 bg-white">
        <div className="border-b border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600">
          Kết quả tìm kiếm cho “{params.get('q')}”: <b>{results.length}</b> task
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
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
      <div className="min-w-0 flex-1">
        {selected ? <TaskDetail task={selected} /> : <Empty label="Chọn một task để xem chi tiết." />}
      </div>
    </div>
  )
}
