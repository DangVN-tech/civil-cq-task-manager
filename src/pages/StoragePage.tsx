import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Button, ConfirmDialog, Loading } from '../components/ui'
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
    <div className="h-full overflow-y-auto p-4">
      <h2 className="mb-3 text-base font-bold">Quản lý dung lượng</h2>

      {/* Thanh dung lượng */}
      <div className="mb-4 border border-gray-300 bg-white p-3">
        <div className="mb-1 flex items-center justify-between text-xs">
          <span className="font-semibold">Kho file đã dùng</span>
          <span className={cn(usagePct >= 80 ? 'font-bold text-red-600' : 'text-gray-500')}>
            {usage != null ? fmtBytes(usage) : '...'} / 1 GB ({usagePct}%)
          </span>
        </div>
        <div className="h-3 w-full bg-gray-200">
          <div
            className={cn('h-full', usagePct >= 80 ? 'bg-red-600' : 'bg-brand-500')}
            style={{ width: `${Math.min(100, usagePct)}%` }}
          />
        </div>
        {usagePct >= 80 && (
          <p className="mt-1 text-xs font-semibold text-red-600">
            ⚠ Cảnh báo: đã dùng {usagePct}% dung lượng miễn phí. Nên xóa bớt file của các task đã hoàn thành lâu.
          </p>
        )}
      </div>

      {error && <p className="mb-2 text-xs text-red-600">{error}</p>}

      {/* Danh sách file: task hoàn thành cũ nhất lên đầu */}
      <div className="border border-gray-300 bg-white">
        <div className="border-b border-gray-200 bg-gray-50 px-3 py-2 text-xs font-bold uppercase text-gray-500">
          Toàn bộ file ({files?.length ?? 0}) — file của task hoàn thành lâu nhất hiện trên đầu
        </div>
        {isLoading ? (
          <Loading />
        ) : (files ?? []).length === 0 ? (
          <p className="p-6 text-center text-sm text-gray-400">Kho file trống.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs text-gray-500">
                <th className="px-3 py-2 font-semibold">Tên file</th>
                <th className="px-3 py-2 font-semibold">Dung lượng</th>
                <th className="px-3 py-2 font-semibold">Thuộc task</th>
                <th className="px-3 py-2 font-semibold">Người upload</th>
                <th className="px-3 py-2 font-semibold">Ngày upload</th>
                <th className="px-3 py-2 text-right font-semibold">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {(files ?? []).map((f) => (
                <tr key={f.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="max-w-64 truncate px-3 py-2 font-medium" title={f.file_name}>
                    <span className="mr-1 inline-block bg-gray-100 px-1 text-[10px] font-mono uppercase text-gray-600">{f.ext}</span>
                    {f.file_name}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-xs">{fmtBytes(f.size_bytes)}</td>
                  <td className="max-w-48 truncate px-3 py-2 text-xs" title={f.task?.title}>
                    {f.task?.title ?? '—'}
                    {f.task?.status === 'hoan_thanh' && f.task.completed_at && (
                      <span className="block text-[10px] text-gray-400">
                        Hoàn thành {fmtDate(f.task.completed_at)}
                      </span>
                    )}
                    {f.task?.status === 'dang_thuc_hien' && (
                      <span className="block text-[10px] text-brand-600">Đang thực hiện</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs">{f.uploader?.full_name ?? '—'}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-xs text-gray-500">{fmtDateTime(f.uploaded_at)}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right">
                    <Button variant="ghost" className="px-2 py-0.5 text-xs text-red-600"
                      onClick={() => setDeleting(f)}>
                      Xóa file này
                    </Button>
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
