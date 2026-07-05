import { supabase } from './supabase'
import { extOf, slugFileName } from './utils'
import {
  ALLOWED_EXTS, BLOCKED_EXTS, MAX_FILES_PER_UPLOAD, MAX_FILE_SIZE,
  type FileRow,
} from '../types'

/** Kiểm tra danh sách file trước khi upload. Trả về thông báo lỗi hoặc null nếu hợp lệ. */
export function validateFiles(files: File[]): string | null {
  if (files.length === 0) return 'Chưa chọn file nào.'
  if (files.length > MAX_FILES_PER_UPLOAD) return `Tối đa ${MAX_FILES_PER_UPLOAD} file mỗi lần upload.`
  for (const f of files) {
    const ext = extOf(f.name)
    if (BLOCKED_EXTS.includes(ext)) return `File "${f.name}" bị chặn (không cho phép ${ext}).`
    if (!ALLOWED_EXTS.includes(ext))
      return `File "${f.name}" không đúng định dạng. Chỉ cho phép: ${ALLOWED_EXTS.join(', ')}.`
    if (f.size > MAX_FILE_SIZE) return `File "${f.name}" vượt quá 50 MB.`
  }
  return null
}

/** Upload nhiều file cho 1 task, ghi metadata vào bảng files. */
export async function uploadTaskFiles(
  taskId: string,
  files: File[],
  uploaderId: string,
  isReference = false,
): Promise<void> {
  for (const f of files) {
    const id = crypto.randomUUID()
    const path = `${taskId}/${id}__${slugFileName(f.name)}`
    const { error: eUp } = await supabase.storage.from('task-files').upload(path, f, {
      contentType: f.type || 'application/octet-stream',
      upsert: false,
    })
    if (eUp) throw new Error(`Upload "${f.name}" thất bại: ${eUp.message}`)
    const { error: eRow } = await supabase.from('files').insert({
      id,
      task_id: taskId,
      uploader_id: uploaderId,
      file_name: f.name,
      ext: extOf(f.name),
      size_bytes: f.size,
      storage_path: path,
      is_reference: isReference,
    })
    if (eRow) throw eRow
  }
}

/** Tải 1 file về máy qua signed URL. */
export async function downloadFile(file: FileRow): Promise<void> {
  const { data, error } = await supabase.storage
    .from('task-files')
    .createSignedUrl(file.storage_path, 300, { download: file.file_name })
  if (error || !data) throw error ?? new Error('Không tạo được link tải')
  const a = document.createElement('a')
  a.href = data.signedUrl
  a.download = file.file_name
  document.body.appendChild(a)
  a.click()
  a.remove()
}

/** Download All: tải toàn bộ file của task, đóng gói zip phía client. */
export async function downloadAllFiles(files: FileRow[], zipName: string): Promise<void> {
  const { default: JSZip } = await import('jszip') // lazy-load: chỉ tải khi bấm Download All
  const zip = new JSZip()
  for (const f of files) {
    const { data, error } = await supabase.storage.from('task-files').download(f.storage_path)
    if (error || !data) throw error ?? new Error(`Tải "${f.file_name}" thất bại`)
    zip.file(f.file_name, data)
  }
  const blob = await zip.generateAsync({ type: 'blob' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${zipName}.zip`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

/** Xóa 1 file (Storage + metadata). */
export async function deleteFile(file: Pick<FileRow, 'id' | 'storage_path'>): Promise<void> {
  const { error: eS } = await supabase.storage.from('task-files').remove([file.storage_path])
  if (eS) throw eS
  const { error } = await supabase.from('files').delete().eq('id', file.id)
  if (error) throw error
}
