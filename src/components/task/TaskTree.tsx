import { useMemo, useState } from 'react'
import { CheckCircle2, ChevronDown, ChevronRight, EyeOff, Folder, FolderOpen, Pencil, Plus } from 'lucide-react'
import { useCurrentUser } from '../../context/AuthContext'
import { useActivityFeed } from '../../hooks/useUpdates'
import { cn, fmtDateTime, timeLeftLabel } from '../../lib/utils'
import type { Priority, Project, Task } from '../../types'
import MarkDot from './MarkDot'
import { UnreadBadge } from '../ui'

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

/** Cây thư mục có đường nối: Dự án -> 📁 Đầu mục -> Task.
 *  Chỉ Trưởng phòng (khi truyền callback): ➕ tạo task vào đầu mục,
 *  ✏️ Sửa Dự án (thêm/xóa/đổi tên đầu mục), ✏️ Sửa Đầu mục (thêm/sửa/xóa task). */
export default function TaskTree({
  tasks,
  selectedId,
  onSelect,
  onAddTask,
  onEditProject,
  onEditGroup,
  onHide,
  skeleton,
}: {
  tasks: Task[]
  selectedId: string | null
  onSelect: (id: string) => void
  onAddTask?: (groupId: string) => void
  onEditProject?: (projectId: string) => void
  onEditGroup?: (groupId: string) => void
  /** Ẩn tay 1 task khỏi cây (chỉ hiển thị, không đổi dữ liệu) */
  onHide?: (taskId: string) => void
  /** Bộ khung dự án/đầu mục đầy đủ: nếu có, hiện cả dự án/đầu mục chưa có task nào */
  skeleton?: Project[]
}) {
  const user = useCurrentUser()
  const { data: feed } = useActivityFeed(user.id)
  const unreadByTask = useMemo(() => {
    const m = new Map<string, number>()
    for (const it of feed ?? []) {
      if (it.is_read || it.actor_id === user.id) continue
      m.set(it.task_id, (m.get(it.task_id) ?? 0) + 1)
    }
    return m
  }, [feed, user.id])

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
    // Gieo trước bộ khung đầy đủ (nếu có) để dự án/đầu mục rỗng vẫn hiện
    if (skeleton) {
      for (const p of skeleton) {
        const node: ProjectNode = { id: p.id, name: p.name, groups: [] }
        for (const g of p.groups ?? []) node.groups.push({ id: g.id, name: g.name, tasks: [] })
        projMap.set(p.id, node)
      }
    }
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
  }, [tasks, skeleton])

  if (treeData.length === 0) {
    return <div className="p-8 text-center text-sm text-slate-400">Không có task nào.</div>
  }

  return (
    <div className="space-y-2 p-2">
      {treeData.map((proj) => {
        const pKey = `p:${proj.id}`
        const pOpen = !collapsed.has(pKey)
        const total = proj.groups.reduce((s, g) => s + g.tasks.length, 0)
        return (
          <div key={proj.id}>
            {/* ===== Cấp 1: Dự án ===== */}
            <div className="group/proj flex items-center">
              <button
                onClick={() => toggle(pKey)}
                className="flex min-w-0 flex-1 items-center gap-1.5 rounded-lg px-2 py-1.5 text-left text-sm font-bold text-slate-900 hover:bg-slate-50"
              >
                {pOpen ? <ChevronDown size={12} className="shrink-0 text-slate-400" /> : <ChevronRight size={12} className="shrink-0 text-slate-400" />}
                <span className="min-w-0 flex-1 truncate uppercase">{proj.name}</span>
                <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                  {total}
                </span>
              </button>
              {onEditProject && proj.id !== '_none' && (
                <button
                  onClick={() => onEditProject(proj.id)}
                  title="Sửa Dự án: đổi tên, thêm/xóa Đầu mục"
                  className="mr-1 shrink-0 rounded-md p-1 text-slate-400 opacity-0 transition-opacity hover:bg-slate-100 hover:text-brand-600 group-hover/proj:opacity-100"
                >
                  <Pencil size={12} />
                </button>
              )}
            </div>

            {/* ===== Cấp 2: Đầu mục (có đường nối dọc) ===== */}
            {pOpen && (
              <div className="ml-[15px] border-l-2 border-slate-200">
                {proj.groups.map((grp) => {
                  const gKey = `g:${grp.id}`
                  const gOpen = !collapsed.has(gKey)
                  return (
                    <div key={grp.id}>
                      <div className="group/row flex items-center">
                        <span className="h-px w-3 shrink-0 bg-slate-200" />
                        <button
                          onClick={() => toggle(gKey)}
                          className="flex min-w-0 flex-1 items-center gap-1.5 rounded-lg px-1.5 py-1 text-left text-[13px] font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          {gOpen ? <ChevronDown size={10} className="shrink-0 text-slate-400" /> : <ChevronRight size={10} className="shrink-0 text-slate-400" />}
                          {gOpen ? <FolderOpen size={13} className="shrink-0 text-amber-500" /> : <Folder size={13} className="shrink-0 text-amber-500" />}
                          <span className="min-w-0 flex-1 truncate">{grp.name}</span>
                          <span className="shrink-0 text-[10px] text-slate-400">{grp.tasks.length}</span>
                        </button>
                        {onEditGroup && grp.id !== '_none' && (
                          <button
                            onClick={() => onEditGroup(grp.id)}
                            title="Sửa Đầu mục: đổi tên, thêm/sửa/xóa task"
                            className="shrink-0 rounded-md p-1 text-slate-400 opacity-0 transition-opacity hover:bg-slate-100 hover:text-brand-600 group-hover/row:opacity-100"
                          >
                            <Pencil size={11} />
                          </button>
                        )}
                        {onAddTask && grp.id !== '_none' && (
                          <button
                            onClick={() => onAddTask(grp.id)}
                            title="Tạo task vào đầu mục này"
                            className="mr-1 shrink-0 rounded-md p-1 text-brand-500 opacity-0 transition-opacity hover:bg-brand-50 group-hover/row:opacity-100"
                          >
                            <Plus size={13} />
                          </button>
                        )}
                      </div>

                      {/* ===== Cấp 3: Task (đường nối dọc tiếp) ===== */}
                      {gOpen && (
                        <div className="ml-[27px] border-l-2 border-slate-200">
                          {grp.tasks.map((t) => {
                            const left = timeLeftLabel(t.deadline)
                            const completed = t.status === 'hoan_thanh'
                            return (
                              <div key={t.id} className="group/task flex items-center">
                                <span className="h-px w-3 shrink-0 bg-slate-200" />
                                <div
                                  role="button"
                                  tabIndex={0}
                                  onClick={() => onSelect(t.id)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(t.id) }
                                  }}
                                  className={cn(
                                    'flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[13px] transition-colors',
                                    t.id === selectedId
                                      ? 'bg-brand-50 font-semibold text-brand-700'
                                      : completed
                                        ? 'text-slate-400 hover:bg-slate-50'
                                        : 'text-slate-700 hover:bg-slate-50',
                                  )}
                                >
                                  {completed ? (
                                    <CheckCircle2 size={13} className="shrink-0 text-emerald-400" />
                                  ) : (
                                    <span className={cn('h-2.5 w-2.5 shrink-0 rounded-full', DOT[t.priority])} />
                                  )}
                                  <MarkDot task={t} />
                                  <span className={cn('min-w-0 flex-1 truncate', completed && 'line-through decoration-slate-300')}>
                                    {t.title}
                                  </span>
                                  {!completed && <UnreadBadge count={unreadByTask.get(t.id) ?? 0} />}
                                  {completed ? (
                                    <span className="shrink-0 text-[11px] font-semibold text-emerald-500">Hoàn thành</span>
                                  ) : (
                                    <>
                                      <span className="shrink-0 text-[11px] font-semibold text-slate-500">{t.progress}%</span>
                                      {t.deadline ? (
                                        <span
                                          className={cn('shrink-0 text-[11px]', left?.overdue ? 'font-semibold text-rose-600' : 'text-slate-400')}
                                          title={fmtDateTime(t.deadline)}
                                        >
                                          {left?.overdue ? 'quá hạn' : left?.text}
                                        </span>
                                      ) : (
                                        <span className="shrink-0 text-[11px] text-slate-300">thường xuyên</span>
                                      )}
                                    </>
                                  )}
                                </div>
                                {onHide && (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); onHide(t.id) }}
                                    title="Ẩn task này khỏi cây"
                                    className="mr-1 shrink-0 rounded-md p-1 text-slate-400 opacity-0 transition-opacity hover:bg-slate-100 hover:text-rose-500 group-hover/task:opacity-100"
                                  >
                                    <EyeOff size={12} />
                                  </button>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
