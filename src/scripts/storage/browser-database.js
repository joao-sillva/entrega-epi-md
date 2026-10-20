/**
 * Minimal promise-based key/value wrapper over IndexedDB.
 * One database with a single object store per `openKeyValueStore` call.
 */
export function openKeyValueStore({ name, storeName }) {
  let connection = null;

  function connect() {
    if (!connection) {
      connection = new Promise((resolve, reject) => {
        if (!window.indexedDB) {
          reject(new Error('IndexedDB indisponível'));
          return;
        }
        let request;
        try {
          request = indexedDB.open(name, 1);
        } catch (error) {
          reject(error);
          return;
        }
        request.onupgradeneeded = () => request.result.createObjectStore(storeName);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
        request.onblocked = () => reject(new Error('Banco de dados bloqueado'));
      }).catch((error) => {
        connection = null;
        throw error;
      });
    }
    return connection;
  }

  function runTransaction(mode, action) {
    return connect().then((database) => new Promise((resolve, reject) => {
      const transaction = database.transaction(storeName, mode);
      const request = action(transaction.objectStore(storeName));
      if (mode === 'readonly') {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      } else {
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error);
      }
    }));
  }

  return {
    read: (key) => runTransaction('readonly', (store) => store.get(key)),
    write: (key, value) => runTransaction('readwrite', (store) => store.put(value, key)),
    remove: (key) => runTransaction('readwrite', (store) => store.delete(key)),
  };
}
