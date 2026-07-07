import { useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { useQueryClient } from '@tanstack/react-query'
import { Download, UploadCloud } from 'lucide-react'
import { useCurrentUser } from '../../context/AuthContext'
import { downloadAllFiles, downloadFile, uploadTaskFiles, validateFiles } from '../../lib/files'
import { canUploadFile } from '../../lib/permissions'
import { cn, fmtBytes, fmtDateTime } from '../../lib/utils'
import type { Task } from '../../types'
import { Button, cardCls } from '../ui'

/** Khu vực file đính kèm: kéo thả / chọn file, tải từng file, Download All. */
export default function FileSection({ task }: { task: Task }) {
  const user = useCurrentUser()
  const qc = useQueryClient()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const allowUpload = canUploadFile(task, user)

  const doUpload = async (files: File[]) => {
    setError('')
    const err = validateFiles(files)
    if (err) return setError(err)
    setBusy(true)
    try {
      await uploadTaskFiles(task.id, files, user.id, false)
      qc.invalidateQueries({ queryKey: ['tasks'] })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload thất bại.')
    } finally {
      setBusy(false)
    }
  }

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: doUpload,
    noClick: false,
    disabled: !allowUpload || busy,
  })

  const files = [...task.files].sort((a, b) => a.uploaded_at.localeCompare(b.uploaded_at))

  return (
    <section className={`${cardCls} p-4`}>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">File đính kèm ({files.length})</h3>
        {files.length > 1 && (
          <Button
            variant="ghost" className="px-2 py-0.5 text-xs"
            onClick={() => downloadAllFiles(files, task.title).catch(() => setError('Tải tất cả thất bại.'))}
          >
            <Download size={13} /> Download All
          </Button>
        )}
      </div>

      {allowUpload && (
        <div
          {...getRootProps()}
          className={cn(
            'mb-2 cursor-pointer rounded-xl border-2 border-dashed bg-slate-50/50 p-5 text-center transition-colors',
            isDragActive ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-slate-200 text-slate-500 hover:border-brand-400 hover:bg-brand-50/20',
          )}
        >
          <input {...getInputProps()} accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.rar" />
          <UploadCloud size={22} className="mx-auto mb-1 text-slate-400" />
          <p className="text-xs font-bold text-slate-600">
            {busy ? 'Đang upload...' : 'Kéo thả file vào đây hoặc bấm để chọn'}
          </p>
          <p className="mt-0.5 text-[10px] text-slate-400">Tối đa 6 file · 50 MB/file</p>
        </div>
      )}

      {error && <p className="mb-2 text-xs text-red-600">{error}</p>}

      {files.length === 0 ? (
        <p className="text-center text-xs italic text-slate-400">Chưa có file nào.</p>
      ) : (
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-100">
          {files.map((f) => (
            <li key={f.id} className="flex items-center gap-2.5 px-2.5 py-2 text-xs transition-colors hover:bg-slate-50/50">
              <span className="inline-block w-11 shrink-0 rounded-md bg-slate-100 px-1 py-1 text-center font-mono text-[10px] font-bold uppercase text-slate-600">
                {f.ext}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold text-slate-800">{f.file_name}</span>
                <span className="text-slate-400">
                  {fmtBytes(f.size_bytes)} · {f.uploader?.full_name ?? '—'} · {fmtDateTime(f.uploaded_at)}
                  {f.is_reference && ' · file tham khảo'}
                </span>
              </span>
              <Button
                variant="ghost" className="px-2 py-0.5 text-xs"
                onClick={() => downloadFile(f).catch(() => setError(`Tải "${f.file_name}" thất bại.`))}
              >
                <Download size={13} /> Tải
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
