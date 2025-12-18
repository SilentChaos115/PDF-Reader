const DB_NAME = 'ZenReaderDB';
const STORE_NAME = 'files';
const VERSION = 1;

const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, VERSION);
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const saveFileToLibrary = async (file: File, thumbnail?: string): Promise<void> => {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  
  const item = {
    id: `${file.name}_${file.size}`,
    name: file.name,
    size: file.size,
    type: file.type,
    date: Date.now(),
    data: file, // IndexedDB can store File/Blob objects directly
    thumbnail: thumbnail || ''
  };
  
  store.put(item);
  return new Promise((resolve) => {
    tx.oncomplete = () => resolve();
  });
};

export const getRecentFiles = async (): Promise<any[]> => {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readonly');
  const store = tx.objectStore(STORE_NAME);
  const request = store.getAll();
  
  return new Promise((resolve) => {
    request.onsuccess = () => {
      // Sort by date desc
      const results = request.result || [];
      resolve(results.sort((a, b) => b.date - a.date));
    };
  });
};

export const getFileFromLibrary = async (id: string): Promise<File | null> => {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readonly');
  const store = tx.objectStore(STORE_NAME);
  const request = store.get(id);
  
  return new Promise((resolve) => {
    request.onsuccess = () => resolve(request.result ? request.result.data : null);
  });
};

export const removeFileFromLibrary = async (id: string): Promise<void> => {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  store.delete(id);
  return new Promise((resolve) => {
    tx.oncomplete = () => resolve();
  });
};