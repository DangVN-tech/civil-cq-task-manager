import { useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { useQueryClient } from '@tanstack/react-query'
import { Download, Paperclip, Send, Trash2, UploadCloud } from 'lucide-react'
import { useCurrentUser } from '../../context/AuthContext'
import { downloadAllFiles, downloadFile, uploadTaskFiles, validateFiles } from '../../lib/files'
import { canUploadFile } from '../../lib/permissions'
import { cn, fmtBytes, fmtDateTime } from '../../lib/utils'
import type { Task } from '../../types'
import { Button, cardCls } from '../ui'

/** Khu vực file đính kèm: kéo thả → staging → Gửi đính kèm. */
export default function FileSection({ task, embedded }: { task: Task; embedded?: boolean }) {
  const user = useCurrentUser()
  const qc = useQueryClient()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const allowUpload = canUploadFile(task, user)

  const onDrop = (dropped: File[]) => {
    setError('')
    const err = validateFiles(dropped)
    if (err) { setError(err); return }
    setPendingFiles((prev) => [...prev, ...dropped])
  }

  const removePending = (idx: number) =>
    setPendingFiles((prev) => prev.filter((_, i) => i !== idx))

  const doUpload = async () => {
    if (pendingFiles.length === 0) return
    setError('')
    setBusy(true)
    try {
      await uploadTaskFiles(task.id, pendingFiles, user.id, false)
      qc.invalidateQueries({ queryKey: ['tasks'] })
      setPendingFiles([])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload thất bại.')
    } finally {
      setBusy(false)
    }
  }

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    noClick: false,
    disabled: !allowUpload || busy,
  })

  const files = [...task.files].sort((a, b) => a.uploaded_at.localeCompare(b.uploaded_at))

  const content = (
    <>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400">
          <Paperclip size={14} className="text-brand-500" /> Tài liệu đính kèm ({files.length})
        </h3>
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
        <>
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
              Kéo thả file vào đây hoặc bấm để chọn
            </p>
            <p className="mt-0.5 text-[10px] text-slate-400">Tối đa 6 file · 50 MB/file</p>
          </div>

          {pendingFiles.length > 0 && (
            <div className="mb-2 rounded-xl border border-amber-200 bg-amber-50 p-2.5">
              <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-700">
                Chờ gửi ({pendingFiles.length} file)
              </p>
              <ul className="space-y-1">
                {pendingFiles.map((f, i) => (
                  <li key={i} className="flex items-center gap-2 text-xs text-slate-700">
                    <span className="flex-1 truncate font-medium">{f.name}</span>
                    <span className="text-[10px] text-slate-400">{fmtBytes(f.size)}</span>
                    <button
                      onClick={() => removePending(i)}
                      className="rounded p-0.5 text-slate-400 hover:bg-rose-50 hover:text-rose-500"
                      title="Xóa đính kèm"
                    >
                      <Trash2 size={12} />
                    </button>
                  </li>
                ))}
              </ul>
              <div className="mt-2 flex gap-2">
                <Button
                  variant="primary" className="flex-1 py-1 text-xs"
                  onClick={doUpload} disabled={busy}
                >
                  <Send size={12} /> {busy ? 'Đang gửi...' : 'Gửi đính kèm'}
                </Button>
                <Button
                  variant="ghost" className="py-1 text-xs text-rose-500"
                  onClick={() => setPendingFiles([])} disabled={busy}
                >
                  <Trash2 size={12} /> Xóa tất cả
                </Button>
              </div>
            </div>
          )}
        </>
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
    </>
  )

  if (embedded) return content
  return <section className={`${cardCls} p-4`}>{content}</section>
}
