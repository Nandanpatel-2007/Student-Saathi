/**
 * Token storage. The access token lives in memory only; the refresh token is kept in
 * localStorage (every access wrapped in try/catch) with an in-memory fallback so a session
 * still works for the life of the page when storage is unavailable.
 */
const REFRESH_KEY = 'ss-refresh-token'

let accessToken: string | null = null
let memoryRefresh: string | null = null

function readStored(): string | null {
  try {
    return localStorage.getItem(REFRESH_KEY)
  } catch {
    return null
  }
}

export const tokenStore = {
  getAccess: (): string | null => accessToken,
  setAccess(token: string | null): void {
    accessToken = token
  },

  getRefresh: (): string | null => memoryRefresh ?? readStored(),
  setRefresh(token: string): void {
    memoryRefresh = token
    try {
      localStorage.setItem(REFRESH_KEY, token)
    } catch {
      // Storage blocked: the in-memory copy still covers this page load.
    }
  },
  hasRefresh: (): boolean => (memoryRefresh ?? readStored()) !== null,

  clear(): void {
    accessToken = null
    memoryRefresh = null
    try {
      localStorage.removeItem(REFRESH_KEY)
    } catch {
      // Nothing to remove if storage is unavailable.
    }
  },
}
