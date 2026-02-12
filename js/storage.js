/**
 * Storage management for D&D Beyond Print Enhancer.
 * Uses IndexedDB to persist layout configurations and custom data.
 */

const DB_NAME = 'DDBPrintEnhancerDB';
const DB_VERSION = 1;
const STORE_NAME = 'layouts';
const SCHEMA_VERSION = '1.0.0';

let db = null;

const Storage = {
  SCHEMA_VERSION,

  /**
   * Initialize the IndexedDB connection.
   */
  init: () => {
    return new Promise((resolve, reject) => {
      if (db) return resolve(db);

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = (event) => {
        console.error('[DDB Print Enhance] IndexedDB error:', event.target.error);
        reject(event.target.error);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'characterId' });
        }
      };

      request.onsuccess = (event) => {
        db = event.target.result;
        resolve(db);
      };
    });
  },

  /**
   * Validates if the object matches the expected layout schema.
   * @param {object} data 
   * @returns {boolean}
   */
  validateLayout: (data) => {
      if (!data || typeof data !== 'object') return false;
      if (data.version === undefined || data.sections === undefined) return false;
      if (typeof data.sections !== 'object') return false;
      return true;
  },

  /**
   * Save character layout data.
   * @param {string} characterId 
   * @param {object} data - { characterId, sectionOrder, customSpells }
   */
  saveLayout: (characterId, data) => {
    return new Promise((resolve, reject) => {
      if (!db) return reject(new Error('Database not initialized'));

      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      
      // Ensure characterId is present in the data object for the keyPath
      const payload = { ...data, characterId };
      
      const request = store.put(payload);

      request.onsuccess = () => resolve();
      request.onerror = (event) => reject(event.target.error);
    });
  },

  /**
   * Load character layout data.
   * @param {string} characterId 
   * @returns {Promise<object|undefined>}
   */
  loadLayout: (characterId) => {
    return new Promise((resolve, reject) => {
      if (!db) return reject(new Error('Database not initialized'));

      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(characterId);

      request.onsuccess = (event) => resolve(event.target.result);
      request.onerror = (event) => reject(event.target.error);
    });
  }
};

// Export for Node.js/Test environment
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    ...Storage,
    SCHEMA_VERSION,
    Storage
  };
}
