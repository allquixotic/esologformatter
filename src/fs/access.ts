// File System Access API helpers (Chromium) with a universal download fallback.

/**
 * Single capability probe: when the browser can grant persistent read/write
 * access to a folder we use the folder workflow; otherwise the classic
 * upload -> process -> download flow. One UI, two implementations.
 */
export const supportsFileSystemAccess =
  typeof window !== 'undefined' && 'showDirectoryPicker' in window

/** True when the user dismissed a picker (not a real failure). */
export function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'AbortError'
}

/** Ask for read/write access to the folder that holds the user's logs. */
export async function pickWorkingDirectory(): Promise<FileSystemDirectoryHandle> {
  return window.showDirectoryPicker({ id: 'esolog-folder', mode: 'readwrite' })
}

/** List plausible chat log files (.log / .txt) directly inside a folder. */
export async function listLogFiles(
  dir: FileSystemDirectoryHandle,
): Promise<FileSystemFileHandle[]> {
  const files: FileSystemFileHandle[] = []
  for await (const handle of dir.values()) {
    if (handle.kind === 'file' && /\.(log|txt)$/i.test(handle.name)) {
      files.push(handle)
    }
  }
  const rank = (h: FileSystemFileHandle): number =>
    h.name.toLowerCase() === 'chatlog.log' ? 0 : 1
  return files.sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name))
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
