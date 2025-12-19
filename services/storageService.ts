

export class StorageService {
  private dbName = 'MoncchichiDB';
  private dbVersion = 6; 
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  constructor() {
    this.initDB().catch(console.error);
  }

  private initDB(): Promise<void> {
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => {
        console.error('StorageService: Failed to open DB');
        this.initPromise = null; // Reset on failure
        reject('Error opening DB');
      };

      request.onsuccess = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result;

        // Handle connection closing events to prevent "The database connection is closing" errors
        this.db.onversionchange = () => {
            console.warn('StorageService: DB version change. Closing.');
            this.db?.close();
            this.db = null;
            this.initPromise = null;
        };

        this.db.onclose = () => {
            console.warn('StorageService: DB connection closed.');
            this.db = null;
            this.initPromise = null;
        };

        this.db.onerror = (e) => {
            console.error('StorageService: DB Error', e);
        };

        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        // Store for Books (Metadata + Content)
        if (!db.objectStoreNames.contains('library')) {
          db.createObjectStore('library', { keyPath: 'id' });
        }
        // Store for Offline Assets (Images/Blobs), key is URL or ID
        if (!db.objectStoreNames.contains('assets')) {
          db.createObjectStore('assets', { keyPath: 'id' });
        }
        // Store for API Responses / Metadata Cache
        if (!db.objectStoreNames.contains('api_cache')) {
          db.createObjectStore('api_cache', { keyPath: 'key' });
        }
        // Store for Quantum Weaver History
        if (!db.objectStoreNames.contains('weaver_history')) {
          db.createObjectStore('weaver_history', { keyPath: 'id' });
        }
        // Store for AI POI Descriptions (Permanent Cache)
        if (!db.objectStoreNames.contains('poi_cache')) {
          db.createObjectStore('poi_cache', { keyPath: 'id' });
        }
        
        // Brokerage stores
        if (!db.objectStoreNames.contains('watchlist')) {
            db.createObjectStore('watchlist', { keyPath: 'symbol' });
        }
        if (!db.objectStoreNames.contains('paper_trades')) {
            db.createObjectStore('paper_trades', { keyPath: 'id' });
        }
      };
    });
    
    return this.initPromise;
  }

  private async getDB(): Promise<IDBDatabase> {
    if (this.db) return this.db;
    await this.initDB();
    if (!this.db) throw new Error("Database not initialized");
    return this.db;
  }

  public async saveItem(storeName: 'library' | 'assets' | 'api_cache' | 'weaver_history' | 'poi_cache' | 'watchlist' | 'paper_trades', item: any): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      try {
        const transaction = db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.put(item);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      } catch (e) {
        // If we catch a transaction creation error (like connection closing), 
        // force reset and let the caller retry or fail gracefully.
        this.db = null;
        this.initPromise = null;
        reject(e);
      }
    });
  }

  public async getItem<T>(storeName: 'library' | 'assets' | 'api_cache' | 'weaver_history' | 'poi_cache' | 'watchlist' | 'paper_trades', id: string): Promise<T | undefined> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      try {
        const transaction = db.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.get(id);

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      } catch (e) {
        this.db = null;
        this.initPromise = null;
        reject(e);
      }
    });
  }

  public async getAllItems<T>(storeName: 'library' | 'assets' | 'api_cache' | 'weaver_history' | 'poi_cache' | 'watchlist' | 'paper_trades'): Promise<T[]> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      try {
        const transaction = db.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.getAll();

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      } catch (e) {
        this.db = null;
        this.initPromise = null;
        reject(e);
      }
    });
  }

  public async deleteItem(storeName: 'library' | 'assets' | 'api_cache' | 'weaver_history' | 'poi_cache' | 'watchlist' | 'paper_trades', id: string): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      try {
        const transaction = db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.delete(id);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      } catch (e) {
        this.db = null;
        this.initPromise = null;
        reject(e);
      }
    });
  }

  // --- Asset / PDF Helpers ---

  public async saveAsset(id: string, blob: Blob): Promise<void> {
      await this.saveItem('assets', { id, blob, timestamp: Date.now() });
  }

  public async getAssetBlob(id: string): Promise<Blob | null> {
      try {
          const item = await this.getItem<{id: string, blob: Blob}>('assets', id);
          return item ? item.blob : null;
      } catch (e) {
          return null;
      }
  }

  // --- Caching Helpers ---

  public async setCache(key: string, data: any, ttlMinutes: number = 60): Promise<void> {
    const expiry = Date.now() + (ttlMinutes * 60 * 1000);
    await this.saveItem('api_cache', { key, data, expiry });
  }

  public async getCache<T>(key: string): Promise<T | null> {
    try {
      const item = await this.getItem<{ key: string, data: T, expiry: number }>('api_cache', key);
      if (!item) return null;
      
      if (Date.now() > item.expiry) {
        await this.deleteItem('api_cache', key);
        return null;
      }
      return item.data;
    } catch (e) {
      return null;
    }
  }

  public async cacheImage(url: string): Promise<string> {
    try {
      // 1. Try Direct Fetch (some CDNs allow CORS)
      let response = await fetch(url).catch(() => null);
      
      // 2. Try Proxy if direct fails
      if (!response || !response.ok) {
           const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(url)}`;
           response = await fetch(proxyUrl).catch(() => null);
      }
      
      if (!response || !response.ok) {
           // Graceful Failure: Return the original URL so the app can attempt 
           // to load it via <img> tag (which might succeed due to laxer CORS on images)
           // or show a placeholder.
           return url;
      }
      
      const blob = await response.blob();
      
      const id = url; 
      await this.saveItem('assets', { id, blob, timestamp: Date.now() });
      return id;
    } catch (e) {
      // Don't log error to console to prevent noise, just return original URL
      return url; 
    }
  }
  
  public async getCachedImageUrl(url: string): Promise<string | null> {
      try {
          const item = await this.getItem<{id: string, blob: Blob}>('assets', url);
          if (item && item.blob) {
              return URL.createObjectURL(item.blob);
          }
          return null;
      } catch (e) {
          return null;
      }
  }
}

export const storageService = new StorageService();