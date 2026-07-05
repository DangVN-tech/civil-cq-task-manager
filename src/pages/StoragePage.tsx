import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ConfirmDialog, Loading } from '../components/ui'
import { useAllFiles, useStorageUsage } from '../hooks/useStorage'
import { deleteFile } from '../lib/files'
import { cn, fmtBytes, fmtDate, fmtDateTime } from '../lib/utils'
import { STORAGE_QUOTA, type FileRow } from '../types'

/** Quản lý dung lượng kho file — chỉ Trưởng phòng.
 *  File của task hoàn thành cũ nhất hiện lên đầu (ít cần nhất).
 *  Xóa 100% thủ công qua nút [Xóa file này] + popup xác nhận. */
export default function StoragePage() {
  const qc = useQueryClient()
  const { data: usage } = useStorageUsage()
  const { data: files, isLoading } = useAllFiles()
  const [deleting, setDeleting] = useState<FileRow | null>(null)
  const [error, setError] = useState('')

  const usagePct = usage != null ? Math.round((usage / STORAGE_QUOTA) * 100) : 0

  const doDelete = async (f: FileRow) => {
    setError('')
    try {
      await deleteFile(f)
      qc.invalidateQueries({ queryKey: ['all-files'] })
      qc.invalidateQueries({ queryKey: ['storage-usage'] })
      qc.invalidateQueries({ queryKey: ['tasks'] })
    } catch {
      setError(`Xóa "${f.file_name}" thất bại. Thử lại.`)
    }
  }

  return (
    <div className="h-full space-y-5 overflow-y-auto p-6">
      <h2 className="text-xl font-bold text-slate-950">Quản lý dung lượng</h2>

      {/* Thanh dung lượng */}
      <div className="space-y-2.5 rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-slate-600">Kho file đã dùng</span>
          <span className={cn('text-sm font-bold', usagePct >= 80 ? 'text-rose-600' : 'text-brand-500')}>
            {usage != null ? fmtBytes(usage) : '...'} / 1 GB ({usagePct}%)
          </span>
        </div>
        <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className={cn('h-full rounded-full', usagePct >= 80 ? 'bg-rose-600' : 'bg-brand-500')}
            style={{ width: `${Math.max(1, Math.min(100, usagePct))}%` }}
          />
        </div>
        {usagePct >= 80 && (
          <p className="text-xs font-semibold text-rose-600">
            ⚠ Cảnh báo: đã dùng {usagePct}% dung lượng miễn phí. Nên xóa bớt file của các task đã hoàn thành lâu.
          </p>
        )}
      </div>

      {error && <p className="text-xs text-rose-600">{error}</p>}

      {/* Danh sách file: task hoàn thành cũ nhất lên đầu */}
      <div className="overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm">
        <div className="border-b border-slate-100 bg-slate-50/50 p-4 text-xs font-bold uppercase tracking-wider text-slate-500">
          Toàn bộ file ({files?.length ?? 0}) — file của task hoàn thành lâu nhất hiện trên đầu
        </div>
        {isLoading ? (
          <Loading />
        ) : (files ?? []).length === 0 ? (
          <p className="p-10 text-center text-sm font-medium text-slate-400">Kho file trống.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-xs font-bold text-slate-400">
                <th className="p-4 font-bold">Tên file</th>
                <th className="p-4 font-bold">Dung lượng</th>
                <th className="p-4 font-bold">Thuộc task</th>
                <th className="p-4 font-bold">Người upload</th>
                <th className="p-4 font-bold">Ngày upload</th>
                <th className="p-4 text-right font-bold">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(files ?? []).map((f) => (
                <tr key={f.id} className="transition-colors hover:bg-slate-50/50">
                  <td className="max-w-64 truncate p-4 font-semibold text-slate-900" title={f.file_name}>
                    <span className="mr-1.5 inline-block rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase text-slate-600">{f.ext}</span>
                    {f.file_name}
                  </td>
                  <td className="whitespace-nowrap p-4 text-xs">{fmtBytes(f.size_bytes)}</td>
                  <td className="max-w-48 truncate p-4 text-xs" title={f.task?.title}>
                    {f.task?.title ?? '—'}
                    {f.task?.status === 'hoan_thanh' && f.task.completed_at && (
                      <span className="block text-[10px] text-slate-400">
                        Hoàn thành {fmtDate(f.task.completed_at)}
                      </span>
                    )}
                    {f.task?.status === 'dang_thuc_hien' && (
                      <span className="block text-[10px] font-medium text-brand-500">Đang thực hiện</span>
                    )}
                  </td>
                  <td className="p-4 text-xs">{f.uploader?.full_name ?? '—'}</td>
                  <td className="whitespace-nowrap p-4 text-xs text-slate-500">{fmtDateTime(f.uploaded_at)}</td>
                  <td className="whitespace-nowrap p-4 text-right">
                    <button className="text-xs font-medium text-rose-600 hover:underline"
                      onClick={() => setDeleting(f)}>
                      Xóa file này
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <ConfirmDialog
        open={!!deleting} onClose={() => setDeleting(null)}
        title="Xóa file" danger confirmLabel="Xóa file"
        message={
          <>
            Xóa vĩnh viễn file <b>{deleting?.file_name}</b> ({deleting ? fmtBytes(deleting.size_bytes) : ''})
            khỏi kho để giải phóng dung lượng? Không thể hoàn tác.
          </>
        }
        onConfirm={() => deleting && doDelete(deleting)}
      />
    </div>
  )
}
