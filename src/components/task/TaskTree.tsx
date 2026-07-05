import { useMemo, useState } from 'react'
import { cn, fmtDateTime, timeLeftLabel } from '../../lib/utils'
import type { Priority, Task } from '../../types'
import MarkDot from './MarkDot'

/* Chấm màu ưu tiên trong cây: 🔴 Khẩn, 🟠 Gấp, ⚪ Thường */
const DOT: Record<Priority, string> = {
  khan: 'bg-rose-500',
  gap: 'bg-amber-500',
  thuong: 'bg-slate-300',
}

interface ProjectNode {
  id: string
  name: string
  groups: { id: string; name: string; tasks: Task[] }[]
}

/** Chế độ xem cây thư mục: Dự án -> Nhóm công việc -> Task. */
export default function TaskTree({
  tasks,
  selectedId,
  onSelect,
}: {
  tasks: Task[]
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  // Nút nào đang thu gọn (mặc định: tất cả mở rộng)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const toggle = (key: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const treeData = useMemo<ProjectNode[]>(() => {
    const projMap = new Map<string, ProjectNode>()
    for (const t of tasks) {
      const pId = t.group?.project?.id ?? '_none'
      const pName = t.group?.project?.name ?? 'Chưa phân loại'
      const gId = t.group?.id ?? '_none'
      const gName = t.group?.name ?? 'Chưa phân loại'
      if (!projMap.has(pId)) projMap.set(pId, { id: pId, name: pName, groups: [] })
      const proj = projMap.get(pId)!
      let grp = proj.groups.find((g) => g.id === gId)
      if (!grp) {
        grp = { id: gId, name: gName, tasks: [] }
        proj.groups.push(grp)
      }
      grp.tasks.push(t)
    }
    const arr = Array.from(projMap.values())
    for (const p of arr) p.groups.sort((a, b) => a.name.localeCompare(b.name, 'vi'))
    return arr.sort((a, b) => a.name.localeCompare(b.name, 'vi'))
  }, [tasks])

  if (treeData.length === 0) {
    return <div className="p-8 text-center text-sm text-slate-400">Không có task nào.</div>
  }

  return (
    <div className="space-y-1 p-2">
      {treeData.map((proj) => {
        const pKey = `p:${proj.id}`
        const pOpen = !collapsed.has(pKey)
        const total = proj.groups.reduce((s, g) => s + g.tasks.length, 0)
        return (
          <div key={proj.id}>
            {/* Cấp 1: Dự án */}
            <button
              onClick={() => toggle(pKey)}
              className="flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-left text-sm font-bold text-slate-900 hover:bg-slate-50"
            >
              <span className="w-3 text-[10px] text-slate-400">{pOpen ? '▼' : '▶'}</span>
              <span className="min-w-0 flex-1 truncate">{proj.name}</span>
              <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                {total}
              </span>
            </button>

            {pOpen && proj.groups.map((grp) => {
              const gKey = `g:${grp.id}`
              const gOpen = !collapsed.has(gKey)
              return (
                <div key={grp.id} className="ml-4">
                  {/* Cấp 2: Nhóm công việc */}
                  <button
                    onClick={() => toggle(gKey)}
                    className="flex w-full items-center gap-1.5 rounded-lg px-2 py-1 text-left text-[13px] font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    <span className="w-3 text-[10px] text-slate-400">{gOpen ? '▼' : '▶'}</span>
                    <span className="min-w-0 flex-1 truncate">📁 {grp.name}</span>
                    <span className="shrink-0 text-[10px] text-slate-400">{grp.tasks.length}</span>
                  </button>

                  {/* Cấp 3: Task */}
                  {gOpen && grp.tasks.map((t) => {
                    const left = timeLeftLabel(t.deadline)
                    return (
                      <button
                        key={t.id}
                        onClick={() => onSelect(t.id)}
                        className={cn(
                          'ml-4 flex w-[calc(100%-1rem)] items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[13px] transition-colors',
                          t.id === selectedId ? 'bg-brand-50 font-semibold text-brand-700' : 'text-slate-700 hover:bg-slate-50',
                        )}
                      >
                        <span className={cn('h-2.5 w-2.5 shrink-0 rounded-full', DOT[t.priority])} />
                        <MarkDot task={t} />
                        <span className="min-w-0 flex-1 truncate">{t.title}</span>
                        <span className="shrink-0 text-[11px] font-semibold text-slate-500">{t.progress}%</span>
                        {t.deadline ? (
                          <span className={cn('shrink-0 text-[11px]', left?.overdue ? 'font-semibold text-rose-600' : 'text-slate-400')}
                            title={fmtDateTime(t.deadline)}>
                            {left?.overdue ? 'quá hạn' : left?.text}
                          </span>
                        ) : (
                          <span className="shrink-0 text-[11px] text-slate-300">thường xuyên</span>
                        )}
                      </button>
                    )
                  })}
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}
