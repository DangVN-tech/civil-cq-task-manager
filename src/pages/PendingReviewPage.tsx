import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import TaskCard from '../components/task/TaskCard'
import TaskDetail from '../components/task/TaskDetail'
import { Empty, FilterAccordion, Loading, Select } from '../components/ui'
import { ResizeHandle, useColumnResize } from '../hooks/useColumnResize'
import { useTasks } from '../hooks/useTasks'
import { PRIORITY_LABEL, type Priority } from '../types'

type SortBy = 'default' | 'title'

/** Task đã được Chủ trì gửi "Hoàn tất", chờ Trưởng phòng xác nhận hoặc trả về. */
export default function PendingReviewPage() {
  const { data: tasks, isLoading } = useTasks('cho_duyet')
  const [params, setParams] = useSearchParams()
  const selectedId = params.get('task')

  const [priority, setPriority] = useState<'' | Priority>('')
  const [sortBy, setSortBy] = useState<SortBy>('default')
  const activeFilterCount = [priority !== '', sortBy !== 'default'].filter(Boolean).length

  const list = useMemo(() => {
    let arr = tasks ?? []
    if (priority) arr = arr.filter((t) => t.priority === priority)
    if (sortBy === 'title') return [...arr].sort((a, b) => a.title.localeCompare(b.title, 'vi'))
    return [...arr].sort((a, b) => b.updated_at.localeCompare(a.updated_at)) // gửi gần nhất lên đầu
  }, [tasks, priority, sortBy])

  const selected = (tasks ?? []).find((t) => t.id === selectedId) ?? null
  const { width, startDrag } = useColumnResize('ccq-w-list', 400, 300, 640)

  return (
    <div className="flex h-full">
      <div className="flex shrink-0 flex-col border-r border-slate-100 bg-white" style={{ width }}>
        <FilterAccordion activeCount={activeFilterCount} onReset={() => { setPriority(''); setSortBy('default') }}>
          <Select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortBy)} className="py-1 text-xs">
            <option value="default">Gửi duyệt gần nhất</option>
            <option value="title">Theo tên task</option>
          </Select>
          <Select value={priority} onChange={(e) => setPriority(e.target.value as '' | Priority)} className="py-1 text-xs">
            <option value="">Ưu tiên: tất cả</option>
            {(Object.keys(PRIORITY_LABEL) as Priority[]).map((p) => (
              <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>
            ))}
          </Select>
        </FilterAccordion>

        <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto p-3">
          {isLoading ? (
            <Loading />
          ) : list.length === 0 ? (
            <Empty label="Không có task nào chờ duyệt." />
          ) : (
            list.map((t) => (
              <TaskCard key={t.id} task={t} selected={t.id === selectedId}
                onClick={() => setParams({ task: t.id })} />
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
