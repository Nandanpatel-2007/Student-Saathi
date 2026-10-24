import { useState } from 'react'

import { useDebouncedValue } from './useDebouncedValue'

/** Search box + page number for a server-paginated list. Typing resets to page 1. */
export function useSearchPaging(delay = 300) {
  const [search, setSearch] = useState('')
  const term = useDebouncedValue(search.trim(), delay)
  const [paging, setPaging] = useState({ term: '', page: 1 })
  const page = paging.term === term ? paging.page : 1
  return {
    search,
    setSearch,
    /** The debounced term to send to the server. */
    term,
    page,
    setPage: (next: number) => setPaging({ term, page: next }),
  }
}
