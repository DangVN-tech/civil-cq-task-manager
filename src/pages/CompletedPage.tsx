import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import TaskCard from '../components/task/TaskCard'
import TaskDetail from '../components/task/TaskDetail'
import { Empty, FilterAccordion, Loading, Select } from '../components/ui'
import { ResizeHandle, useColumnResize } from '../hooks/useColumnResize'
import { useTasks } from '../hooks/useTasks'
import { completedGroupLabel } from '../lib/utils'
import { PRIORITY_LABEL, type Priority, type Task } from '../types'

type SortBy = 'date' | 'deadline' | 'title'

export default function CompletedPage() {
  const { data: tasks, isLoading } = useTasks('hoan_thanh')
  const [params, setParams] = useSearchParams()
  const selectedId = params.get('task')

  const [priority, setPriority] = useState<'' | Priority>('')
  const [sortBy, setSortBy] = useState<SortBy>('date')
  const activeFilterCount = [priority !== '', sortBy !== 'date'].filter(Boolean).length

  const groups = useMemo(() => {
    let arr = tasks ?? []
    if (priority) arr = arr.filter((t) => t.priority === priority)
    if (sortBy === 'deadline') arr = [...arr].sort((a, b) => (a.deadline ?? '9999').localeCompare(b.deadline ?? '9999'))
    else if (sortBy === 'title') arr = [...arr].sort((a, b) => a.title.localeCompare(b.title, 'vi'))
    else arr = [...arr].sort((a, b) => (b.completed_at ?? '').localeCompare(a.completed_at ?? ''))

    // Nhóm theo ngày hoàn thành kiểu Outlook (chỉ khi sort mặc định theo ngày)
    if (sortBy !== 'date') return [{ label: '', items: arr }]
    const map = new Map<string, Task[]>()
    for (const t of arr) {
      const label = t.completed_at ? completedGroupLabel(t.completed_at) : 'Khác'
      if (!map.has(label)) map.set(label, [])
      map.get(label)!.push(t)
    }
    return Array.from(map.entries()).map(([label, items]) => ({ label, items }))
  }, [tasks, priority, sortBy])

  const selected = (tasks ?? []).find((t) => t.id === selectedId) ?? null
  const { width, startDrag } = useColumnResize('ccq-w-list', 400, 300, 640)

  return (
    <div className="flex h-full">
      <div className="flex shrink-0 flex-col border-r border-slate-100 bg-white" style={{ width }}>
        <FilterAccordion activeCount={activeFilterCount} onReset={() => { setPriority(''); setSortBy('date') }}>
          <Select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortBy)} className="py-1 text-xs">
            <option value="date">Theo ngày hoàn thành</option>
            <option value="deadline">Theo deadline</option>
            <option value="title">Theo tên task</option>
          </Select>
          <Select value={priority} onChange={(e) => setPriority(e.target.value as '' | Priority)} className="py-1 text-xs">
            <option value="">Ưu tiên: tất cả</option>
            {(Object.keys(PRIORITY_LABEL) as Priority[]).map((p) => (
              <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>
            ))}
          </Select>
        </FilterAccordion>

        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {isLoading ? (
            <Loading />
          ) : groups.every((g) => g.items.length === 0) ? (
            <Empty label="Chưa có task hoàn thành." />
          ) : (
            groups.map((g) => (
              <div key={g.label || 'all'} className="mb-3 space-y-2.5">
                {g.label && (
                  <div className="sticky top-0 z-[1] bg-white px-1 pb-1 pt-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    {g.label}
                  </div>
                )}
                {g.items.map((t) => (
                  <TaskCard key={t.id} task={t} selected={t.id === selectedId}
                    onClick={() => setParams({ task: t.id })} />
                ))}
              </div>
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
