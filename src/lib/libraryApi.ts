import { parseLibraryBundle, type LibraryBundle } from './libraryBundle'

export async function getLibraryBundle(): Promise<LibraryBundle> {
  const response = await apiJson<unknown>('/api/library')
  return parseLibraryBundle(response)
}

export async function saveLibraryBundle(
  library: LibraryBundle,
): Promise<LibraryBundle> {
  const response = await apiJson<unknown>('/api/library', {
    body: JSON.stringify({ library }),
    method: 'PUT',
  })
  return parseLibraryBundle(response)
}

async function apiJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      Accept: 'application/json',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers,
    },
  })
  const data = (await response.json().catch(() => ({}))) as unknown

  if (!response.ok) {
    const message =
      typeof data === 'object' &&
      data !== null &&
      typeof (data as { error?: unknown }).error === 'string'
        ? (data as { error: string }).error
        : `Library request failed with HTTP ${response.status}.`
    throw new Error(message)
  }

  return data as T
}
