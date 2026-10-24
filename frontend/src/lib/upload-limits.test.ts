import { describe, expect, it } from 'vitest'

import {
  ACCEPT_ATTRIBUTE,
  ALLOWED_EXTENSIONS,
  MAX_UPLOAD_BYTES,
  extensionOf,
  formatBytes,
  validateFile,
} from './upload-limits'

describe('validateFile', () => {
  it('accepts every allowed type in any letter case', () => {
    for (const ext of ALLOWED_EXTENSIONS) {
      expect(validateFile({ name: `work.${ext}`, size: 10 })).toBeNull()
      expect(validateFile({ name: `WORK.${ext.toUpperCase()}`, size: 10 })).toBeNull()
    }
  })

  it('rejects other types, including double extensions and no extension', () => {
    for (const name of ['virus.exe', 'page.html', 'x.pdf.exe', 'noextension', 'archive.7z']) {
      expect(validateFile({ name, size: 10 })).toMatch(/isn’t allowed/)
    }
  })

  it('rejects empty files and files over the limit, but allows exactly the limit', () => {
    expect(validateFile({ name: 'a.pdf', size: 0 })).toBe('The file is empty.')
    expect(validateFile({ name: 'a.pdf', size: MAX_UPLOAD_BYTES })).toBeNull()
    expect(validateFile({ name: 'a.pdf', size: MAX_UPLOAD_BYTES + 1 })).toBe('The file is too large. The limit is 10 MB.')
  })
})

describe('helpers', () => {
  it('builds the accept attribute', () => {
    expect(ACCEPT_ATTRIBUTE.split(',')).toHaveLength(ALLOWED_EXTENSIONS.length)
    expect(ACCEPT_ATTRIBUTE).toContain('.pdf')
  })

  it('finds extensions and formats sizes', () => {
    expect(extensionOf('a.b.PDF')).toBe('pdf')
    expect(extensionOf('none')).toBe('')
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(1536)).toBe('1.5 KB')
    expect(formatBytes(5 * 1024 * 1024)).toBe('5 MB')
  })
})
