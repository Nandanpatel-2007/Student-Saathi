/**
 * What students may upload. This mirrors apps/assignments/uploads.py on the backend, which is
 * the real gatekeeper; checking here just gives instant feedback. Keep the two lists in step.
 */
export const ALLOWED_EXTENSIONS = [
  'pdf',
  'doc',
  'docx',
  'ppt',
  'pptx',
  'xls',
  'xlsx',
  'txt',
  'png',
  'jpg',
  'jpeg',
  'zip',
] as const

export const MAX_UPLOAD_MB = 10
export const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024

/** Value for <input type="file" accept>. */
export const ACCEPT_ATTRIBUTE = ALLOWED_EXTENSIONS.map((ext) => `.${ext}`).join(',')

export const ALLOWED_LABEL = ALLOWED_EXTENSIONS.map((ext) => ext.toUpperCase()).join(', ')

export function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot === -1 ? '' : name.slice(dot + 1).toLowerCase()
}

/** An error message, or null when the file looks acceptable. */
export function validateFile(file: { name: string; size: number }): string | null {
  const ext = extensionOf(file.name)
  if (!(ALLOWED_EXTENSIONS as readonly string[]).includes(ext)) {
    return `This file type isn’t allowed. Upload one of: ${ALLOWED_LABEL}.`
  }
  if (file.size <= 0) return 'The file is empty.'
  if (file.size > MAX_UPLOAD_BYTES) return `The file is too large. The limit is ${MAX_UPLOAD_MB} MB.`
  return null
}

/** 1536 -> "1.5 KB". */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Number((bytes / 1024).toFixed(1))} KB`
  return `${Number((bytes / (1024 * 1024)).toFixed(1))} MB`
}
