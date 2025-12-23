
const DB_NAME = 'ZenReaderDB';
const STORE_FILES = 'files';
const STORE_SECTIONS = 'sections';
const STORE_CACHED_TEXT = 'cachedText';
const VERSION = 3; 

const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, VERSION);
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_FILES)) {
        db.createObjectStore(STORE_FILES, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_SECTIONS)) {
        db.createObjectStore(STORE_SECTIONS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_CACHED_TEXT)) {
        db.createObjectStore(STORE_CACHED_TEXT, { keyPath: 'fileId' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const updateFileDate = async (id: string): Promise<void> => {
  const db = await openDB();
  const tx = db.transaction(STORE_FILES, 'readwrite');
  const store = tx.objectStore(STORE_FILES);
  const request = store.get(id);
  return new Promise((resolve) => {
    request.onsuccess = () => {
      if (request.result) {
        request.result.date = Date.now();
        store.put(request.result);
      }
      resolve();
    };
  });
};

export const saveFileToLibrary = async (file: File, thumbnail?: string): Promise<void> => {
  const db = await openDB();
  const tx = db.transaction(STORE_FILES, 'readwrite');
  const store = tx.objectStore(STORE_FILES);
  
  const id = `${file.name}_${file.size}`;
  const existingRequest = store.get(id);
  const existing = await new Promise<any>((resolve) => {
    existingRequest.onsuccess = () => resolve(existingRequest.result);
  });

  const now = Date.now();

  const item = {
    id,
    name: file.name,
    size: file.size,
    type: file.type,
    // Use file timestamp if available, but fallback to now.
    date: (file.lastModified) ? file.lastModified : now,
    // Critical for mobile: Add a specific import timestamp for consistent 'Recent' sorting
    // regardless of OS file system behavior
    dateAdded: now,
    data: file,
    thumbnail: thumbnail || '',
    sectionId: existing?.sectionId || 'uncategorized'
  };
  
  store.put(item);
  return new Promise((resolve) => {
    tx.oncomplete = () => resolve();
  });
};

export const updateFileSection = async (fileId: string, sectionId: string): Promise<void> => {
  const db = await openDB();
  const tx = db.transaction(STORE_FILES, 'readwrite');
  const store = tx.objectStore(STORE_FILES);
  
  return new Promise((resolve, reject) => {
    const request = store.get(fileId);
    request.onsuccess = () => {
      if (request.result) {
        request.result.sectionId = sectionId;
        store.put(request.result);
      } else {
        resolve();
      }
    };
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => resolve();
  });
};

export const saveCachedText = async (fileId: string, pageNumber: number, sentences: string[]): Promise<void> => {
  const db = await openDB();
  const tx = db.transaction(STORE_CACHED_TEXT, 'readwrite');
  const store = tx.objectStore(STORE_CACHED_TEXT);
  const existingReq = store.get(fileId);
  const existing = await new Promise<any>((resolve) => {
    existingReq.onsuccess = () => resolve(existingReq.result || { fileId, pages: {} });
  });

  existing.pages[pageNumber] = sentences;
  store.put(existing);
  return new Promise((resolve) => {
    tx.oncomplete = () => resolve();
  });
};

export const getCachedText = async (fileId: string, pageNumber: number): Promise<string[] | null> => {
  const db = await openDB();
  const tx = db.transaction(STORE_CACHED_TEXT, 'readonly');
  const store = tx.objectStore(STORE_CACHED_TEXT);
  const request = store.get(fileId);
  
  const result = await new Promise<any>((resolve) => {
    request.onsuccess = () => resolve(request.result);
  });
  return result?.pages?.[pageNumber] || null;
};

export const clearTextCache = async (): Promise<void> => {
  const db = await openDB();
  const tx = db.transaction(STORE_CACHED_TEXT, 'readwrite');
  tx.objectStore(STORE_CACHED_TEXT).clear();
  return new Promise((resolve) => { tx.oncomplete = () => resolve(); });
};

export const resetAppDatabase = async (): Promise<boolean> => {
  console.log("Initiating Targeted Wipe...");
  
  try {
    // 1. Close active DB connections FIRST to release file locks
    try {
      const db = await openDB();
      db.close();
    } catch (e) { /* ignore */ }

    // 2. Targeted Wipe: Clear Storage APIs
    localStorage.clear();
    sessionStorage.clear();

    // 3. Targeted Wipe: Explicitly delete the specific IndexedDB
    await new Promise<void>((resolve, reject) => {
        const req = indexedDB.deleteDatabase(DB_NAME);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
        req.onblocked = () => {
            console.warn("DB Delete Blocked - proceeding with partial reset");
            resolve();
        };
    });

    // 4. Cache Purge: Only delete non-essential caches
    // We preserve 'zenreader-v1' to keep the app shell intact (preventing offline breakage)
    if ('caches' in window) {
      try {
        const keys = await caches.keys();
        const appShellCache = 'zenreader-v1';
        await Promise.all(keys.map(key => {
            if (key !== appShellCache) {
                return caches.delete(key);
            }
            return Promise.resolve(false);
        }));
      } catch (e) { console.warn("Cache clear warning", e); }
    }
    
    // NOTE: We do NOT unregister Service Workers or reload the page here.
    // State reset is handled by the App component.
    return true;

  } catch (error) {
    console.error("Deep Wipe failed:", error);
    return false;
  }
};

export const getRecentFiles = async (): Promise<any[]> => {
  const db = await openDB();
  const tx = db.transaction(STORE_FILES, 'readonly');
  const store = tx.objectStore(STORE_FILES);
  const request = store.getAll();
  return new Promise((resolve) => {
    request.onsuccess = () => {
      const results = request.result || [];
      // Default Sort by dateAdded (stable import time) descending
      resolve(results.sort((a, b) => (b.dateAdded || b.date) - (a.dateAdded || a.date)));
    };
  });
};

export const removeFileFromLibrary = async (id: string): Promise<void> => {
  const db = await openDB();
  const tx = db.transaction([STORE_FILES, STORE_CACHED_TEXT], 'readwrite');
  tx.objectStore(STORE_FILES).delete(id);
  tx.objectStore(STORE_CACHED_TEXT).delete(id);
  return new Promise((resolve) => { tx.oncomplete = () => resolve(); });
};

export const deleteFiles = async (ids: string[]): Promise<void> => {
  const db = await openDB();
  const tx = db.transaction([STORE_FILES, STORE_CACHED_TEXT], 'readwrite');
  const fileStore = tx.objectStore(STORE_FILES);
  const cacheStore = tx.objectStore(STORE_CACHED_TEXT);

  ids.forEach(id => {
    fileStore.delete(id);
    cacheStore.delete(id);
  });

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
};

export const saveSection = async (section: { id: string, name: string }): Promise<void> => {
  const db = await openDB();
  const tx = db.transaction(STORE_SECTIONS, 'readwrite');
  tx.objectStore(STORE_SECTIONS).put(section);
  return new Promise((resolve) => { tx.oncomplete = () => resolve(); });
};

export const deleteSection = async (id: string): Promise<void> => {
  const db = await openDB();
  const tx = db.transaction([STORE_SECTIONS, STORE_FILES], 'readwrite');
  tx.objectStore(STORE_SECTIONS).delete(id);
  const fileStore = tx.objectStore(STORE_FILES);
  const request = fileStore.getAll();
  request.onsuccess = () => {
    const files = request.result || [];
    files.forEach(file => {
      if (file.sectionId === id) {
        file.sectionId = 'uncategorized';
        fileStore.put(file);
      }
    });
  };
  return new Promise((resolve) => { tx.oncomplete = () => resolve(); });
};

export const getSections = async (): Promise<any[]> => {
  const db = await openDB();
  const tx = db.transaction(STORE_SECTIONS, 'readonly');
  const store = tx.objectStore(STORE_SECTIONS);
  const request = store.getAll();
  return new Promise((resolve) => {
    request.onsuccess = () => resolve(request.result || []);
  });
};