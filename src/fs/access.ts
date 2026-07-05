// File System Access API helpers (Chromium) with graceful fallbacks.

export const supportsFilePickers =
  typeof window !== 'undefined' && 'showOpenFilePicker' in window
export const supportsSaveAs =
  typeof window !== 'undefined' && 'showSaveFilePicker' in window
export const supportsDirectoryPicker =
  typeof window !== 'undefined' && 'showDirectoryPicker' in window

/** True when the user dismissed a picker (not a real failure). */
export function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'AbortError'
}

export async function pickLogFiles(): Promise<FileSystemFileHandle[]> {
  return window.showOpenFilePicker({
    multiple: true,
    types: [
      {
        description: 'ESO chat logs',
        accept: { 'text/plain': ['.log', '.txt'] },
      },
    ],
  })
}

export async function pickOutputDirectory(): Promise<FileSystemDirectoryHandle> {
  return window.showDirectoryPicker({ id: 'esolog-output', mode: 'readwrite' })
}

/**
 * Re-verify (and if needed re-request) permission on a stored handle.
 * Chrome 122+ shows its persistent "Allow on every visit" prompt here.
 */
export async function verifyPermission(
  handle: FileSystemHandle,
  readWrite: boolean,
): Promise<boolean> {
  const opts: FileSystemHandlePermissionDescriptor = { mode: readWrite ? 'readwrite' : 'read' }
  if ((await handle.queryPermission(opts)) === 'granted') {
    return true
  }
  return (await handle.requestPermission(opts)) === 'granted'
}

export async function saveTextAs(suggestedName: string, text: string): Promise<void> {
  const handle = await window.showSaveFilePicker({ suggestedName })
  const writable = await handle.createWritable()
  await writable.write(text)
  await writable.close()
}

export async function writeFileToDirectory(
  dir: FileSystemDirectoryHandle,
  name: string,
  text: string,
): Promise<void> {
  const fileHandle = await dir.getFileHandle(name, { create: true })
  const writable = await fileHandle.createWritable()
  await writable.write(text)
  await writable.close()
}

/** Universal fallback: trigger a browser download of the given text. */
export function downloadText(name: string, text: string, mime = 'text/plain'): void {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = name
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
