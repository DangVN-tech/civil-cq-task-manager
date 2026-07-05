import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import TaskCard from '../components/task/TaskCard'
import TaskDetail from '../components/task/TaskDetail'
import { Button, Empty, Loading, Select } from '../components/ui'
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
  const filtering = priority !== '' || sortBy !== 'date'

  const groups = useMemo(() => {
    let arr = tasks ?? []
    if (priority) arr = arr.filter((t) => t.priority === priority)
    if (sortBy === 'deadline') arr = [...arr].sort((a, b) => a.deadline.localeCompare(b.deadline))
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

  return (
    <div className="flex h-full">
      <div className="flex w-[400px] shrink-0 flex-col border-r border-gray-300 bg-white">
        <div className="flex flex-wrap items-center gap-1.5 border-b border-gray-200 bg-gray-50 p-2 text-xs">
          <Select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortBy)} className="w-auto py-1 text-xs">
            <option value="date">Theo ngày hoàn thành</option>
            <option value="deadline">Theo deadline</option>
            <option value="title">Theo đầu mục</option>
          </Select>
          <Select value={priority} onChange={(e) => setPriority(e.target.value as '' | Priority)} className="w-auto py-1 text-xs">
            <option value="">Ưu tiên: tất cả</option>
            {(Object.keys(PRIORITY_LABEL) as Priority[]).map((p) => (
              <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>
            ))}
          </Select>
          {filtering && (
            <Button variant="ghost" className="px-2 py-1 text-xs text-red-600"
              onClick={() => { setPriority(''); setSortBy('date') }}>
              Tắt lọc
            </Button>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {isLoading ? (
            <Loading />
          ) : groups.every((g) => g.items.length === 0) ? (
            <Empty label="Chưa có task hoàn thành." />
          ) : (
            groups.map((g) => (
              <div key={g.label || 'all'}>
                {g.label && (
                  <div className="sticky top-0 border-b border-gray-200 bg-gray-100 px-3 py-1 text-xs font-bold text-gray-600">
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

      <div className="min-w-0 flex-1">
        {selected ? <TaskDetail task={selected} /> : <Empty label="Chọn một task để xem chi tiết." />}
      </div>
    </div>
  )
}
