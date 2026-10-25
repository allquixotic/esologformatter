/** Clear every store in a database without blocking on other open IndexedDB connections. */
function clearDatabase(name: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name)
    request.onerror = () => reject(request.error)
    request.onblocked = () => reject(new Error(`Storage for ${name} is busy. Close other tabs and try again.`))
    request.onsuccess = () => {
      const db = request.result
      const stores = [...db.objectStoreNames]
      if (stores.length === 0) {
        db.close()
        resolve()
        return
      }
      try {
        const tx = db.transaction(stores, 'readwrite')
        tx.oncomplete = () => { db.close(); resolve() }
        tx.onabort = tx.onerror = () => { db.close(); reject(tx.error) }
        for (const store of stores) tx.objectStore(store).clear()
      } catch (err) {
        db.close()
        reject(err)
      }
    }
  })
}

/** Origin-wide reset: preferences, OAuth state, saved folder handles, and cached content. */
export async function clearSiteStorage(): Promise<void> {
  const results = await Promise.allSettled([
    Promise.resolve().then(() => localStorage.clear()),
    Promise.resolve().then(() => sessionStorage.clear()),
    (async () => {
      if (typeof indexedDB === 'undefined') return
      const databases = typeof indexedDB.databases === 'function'
        ? await indexedDB.databases() : [{ name: 'keyval-store' }]
      const cleared = await Promise.allSettled(databases.flatMap((db) => db.name ? [clearDatabase(db.name)] : []))
      if (cleared.some((result) => result.status === 'rejected')) throw new Error('Could not clear saved browser files.')
    })(),
    (async () => {
      if (typeof caches === 'undefined') return
      await Promise.all((await caches.keys()).map((key) => caches.delete(key)))
    })(),
  ])
  if (results.some((result) => result.status === 'rejected')) {
    throw new Error('Some browser storage could not be cleared. Close other tabs for this site and try again.')
  }
}
