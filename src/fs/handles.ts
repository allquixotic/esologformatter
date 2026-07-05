// FileSystemDirectoryHandle persistence (handles are structured-cloneable, so
// they can live in IndexedDB across visits; localStorage cannot hold them).

import { del, get, set } from 'idb-keyval'

const WORK_DIR_KEY = 'esologformatter.handles.workDir'

export async function rememberWorkingDirectory(handle: FileSystemDirectoryHandle): Promise<void> {
  await set(WORK_DIR_KEY, handle)
}

export async function loadWorkingDirectory(): Promise<FileSystemDirectoryHandle | undefined> {
  return get<FileSystemDirectoryHandle>(WORK_DIR_KEY)
}

export async function clearWorkingDirectory(): Promise<void> {
  await del(WORK_DIR_KEY)
}
