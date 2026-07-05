// FileSystemHandle persistence (handles are structured-cloneable, so they can
// live in IndexedDB across visits; localStorage cannot hold them).

import { del, get, set } from 'idb-keyval'

const INPUT_HANDLES_KEY = 'esologformatter.handles.lastInput'
const OUTPUT_DIR_KEY = 'esologformatter.handles.outputDir'

export async function rememberInputHandles(handles: FileSystemFileHandle[]): Promise<void> {
  await set(INPUT_HANDLES_KEY, handles)
}

export async function loadInputHandles(): Promise<FileSystemFileHandle[] | undefined> {
  return get<FileSystemFileHandle[]>(INPUT_HANDLES_KEY)
}

export async function clearInputHandles(): Promise<void> {
  await del(INPUT_HANDLES_KEY)
}

export async function rememberOutputDirectory(handle: FileSystemDirectoryHandle): Promise<void> {
  await set(OUTPUT_DIR_KEY, handle)
}

export async function loadOutputDirectory(): Promise<FileSystemDirectoryHandle | undefined> {
  return get<FileSystemDirectoryHandle>(OUTPUT_DIR_KEY)
}

export async function clearOutputDirectory(): Promise<void> {
  await del(OUTPUT_DIR_KEY)
}
