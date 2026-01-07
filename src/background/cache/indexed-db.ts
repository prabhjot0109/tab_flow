// ============================================================================
// INDEXEDDB STORAGE WRAPPER
// ============================================================================

export class SimpleIDB {
  private dbName: string;
  private storeName: string;
  private db: IDBDatabase | null;
  private initPromise: Promise<IDBDatabase>;

  constructor(dbName: string, storeName: string) {
    this.dbName = dbName;
    this.storeName = storeName;
    this.db = null;
    this.initPromise = this._open();
  }

  private _open(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db!);
      };
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest)!.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName);
        }
      };
    });
  }

  async getAll(): Promise<unknown[]> {
    await this.initPromise;
    if (!this.db) throw new Error("DB not initialized");
    return new Promise<unknown[]>((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], "readonly");
      const store = transaction.objectStore(this.storeName);
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getAllKeys(): Promise<IDBValidKey[]> {
    await this.initPromise;
    if (!this.db) throw new Error("DB not initialized");
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], "readonly");
      const store = transaction.objectStore(this.storeName);
      const request = store.getAllKeys();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async set(key: IDBValidKey, value: unknown): Promise<void> {
    await this.initPromise;
    if (!this.db) throw new Error("DB not initialized");
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], "readwrite");
      const store = transaction.objectStore(this.storeName);
      const request = store.put(value, key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async delete(key: IDBValidKey): Promise<void> {
    await this.initPromise;
    if (!this.db) throw new Error("DB not initialized");
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], "readwrite");
      const store = transaction.objectStore(this.storeName);
      const request = store.delete(key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async clear(): Promise<void> {
    await this.initPromise;
    if (!this.db) throw new Error("DB not initialized");
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], "readwrite");
      const store = transaction.objectStore(this.storeName);
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}




