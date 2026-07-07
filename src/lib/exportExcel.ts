import type ExcelJS from 'exceljs'
import { format } from 'date-fns'
import { supabase } from './supabase'
import { fmtDateTime, isOverdue } from './utils'
import { PRIORITY_LABEL, type Project, type Task } from '../types'

/** Lấy toàn bộ comment (nhật ký xử lý) của mọi task trong 1 lần, nhóm theo task_id. */
async function fetchAllComments(): Promise<Map<string, { created_at: string; content: string }[]>> {
  const { data, error } = await supabase
    .from('comments')
    .select('task_id, content, created_at')
    .order('created_at', { ascending: true })
  if (error) throw error
  const map = new Map<string, { created_at: string; content: string }[]>()
  for (const c of data ?? []) {
    if (!map.has(c.task_id)) map.set(c.task_id, [])
    map.get(c.task_id)!.push(c)
  }
  return map
}

/** Suy ra "Tình trạng" giống văn phong file Action List gốc của phòng. */
function statusLabel(t: Task): string {
  if (t.status === 'hoan_thanh') return 'Hoàn thành'
  if (isOverdue(t)) return 'Behind'
  if (t.progress === 0) return 'Pending'
  return 'Ongoing'
}

/** Số thứ tự dự án dạng chữ cái: 0->A, 1->B ... 25->Z, 26->AA... */
function letterOf(index: number): string {
  let s = ''
  let n = index + 1
  while (n > 0) {
    s = String.fromCharCode(65 + ((n - 1) % 26)) + s
    n = Math.floor((n - 1) / 26)
  }
  return s
}

const HEADER_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } }
const PROJECT_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E7FF' } }
const GROUP_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } }

/** Xuất báo cáo Excel tái tạo đúng cấu trúc "Action List" thật của phòng:
 *  Dự án (A/B/C) -> Đầu mục (1/2/3) -> Task, mỗi nhật ký xử lý tách thành 1 cột riêng. */
export async function exportActionListExcel(projects: Project[], tasks: Task[]): Promise<void> {
  const { default: ExcelJS } = await import('exceljs') // lazy-load: chỉ tải khi bấm Xuất báo cáo Excel
  const commentsByTask = await fetchAllComments()

  const taskByGroup = new Map<string, Task[]>()
  for (const t of tasks) {
    if (!t.group_id) continue
    if (!taskByGroup.has(t.group_id)) taskByGroup.set(t.group_id, [])
    taskByGroup.get(t.group_id)!.push(t)
  }

  const maxLogCols = Math.max(0, ...tasks.map((t) => (commentsByTask.get(t.id) ?? []).length))
  const baseHeaders = ['Stt', 'Hạng mục công việc', 'Mức độ', 'Deadline', 'Tình trạng', 'Chủ trì', 'Liên quan', 'Diễn giải tình trạng']
  const logHeaders = Array.from({ length: maxLogCols }, (_, i) => `Cập nhật ${i + 1}`)
  const headers = [...baseHeaders, ...logHeaders]

  type RowKind = 'header' | 'project' | 'group' | 'task'
  const rows: { kind: RowKind; cells: (string | number)[] }[] = [{ kind: 'header', cells: headers }]

  let projIdx = 0
  for (const p of projects) {
    const groupsWithTasks = (p.groups ?? []).filter((g) => (taskByGroup.get(g.id) ?? []).length > 0)
    if (groupsWithTasks.length === 0) continue
    rows.push({ kind: 'project', cells: [letterOf(projIdx), p.name] })
    projIdx++

    let grpIdx = 0
    for (const g of groupsWithTasks) {
      grpIdx++
      rows.push({ kind: 'group', cells: [String(grpIdx), g.name] })

      for (const t of taskByGroup.get(g.id) ?? []) {
        const chuTri = t.assignees.find((a) => a.assign_role === 'chu_tri')?.user?.full_name ?? ''
        const lienQuan = [
          ...t.assignees.filter((a) => a.assign_role === 'phoi_hop').map((a) => a.user?.full_name ?? '').filter(Boolean),
          ...(t.external_collabs ?? []),
        ].join(', ')
        const logs = commentsByTask.get(t.id) ?? []
        const logCells = logs.map((l) => `[${fmtDateTime(l.created_at)}] ${l.content}`)
        rows.push({
          kind: 'task',
          cells: [
            '', t.title, PRIORITY_LABEL[t.priority],
            t.deadline ? fmtDateTime(t.deadline) : '',
            statusLabel(t), chuTri, lienQuan, t.description,
            ...logCells,
          ],
        })
      }
    }
  }

  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Action List')
  ws.columns = headers.map((_, i) => ({ width: i === 1 ? 42 : i >= 7 ? 38 : 14 }))

  for (const r of rows) {
    const row = ws.addRow(r.cells)
    if (r.kind === 'header') {
      row.font = { bold: true, color: { argb: 'FFFFFFFF' } }
      row.fill = HEADER_FILL
    } else if (r.kind === 'project') {
      row.font = { bold: true }
      row.fill = PROJECT_FILL
    } else if (r.kind === 'group') {
      row.font = { bold: true, italic: true }
      row.fill = GROUP_FILL
    } else {
      row.getCell(8).alignment = { wrapText: true, vertical: 'top' }
      for (let c = 9; c <= headers.length; c++) row.getCell(c).alignment = { wrapText: true, vertical: 'top' }
    }
  }
  ws.views = [{ state: 'frozen', ySplit: 1 }]

  const buf = await wb.xlsx.writeBuffer()
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `Action_List_XDQLCL_${format(new Date(), 'dd-MM-yyyy')}.xlsx`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
