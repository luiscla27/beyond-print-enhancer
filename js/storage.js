/**
 * Storage: IndexedDB data-access layer for layouts, global filters/
 * hue, custom shapes and the spell cache, plus layout migration and
 * validation.
 *
 * Encapsulated from js/main.js (monolith) by track
 * encapsulation_functionality_20260907, Phase 3. Loaded before
 * js/main.js in the production script list (js/background.js) and in
 * the shared test harness boot.
 *
 * Registration seam (ratified decision a): the real object is exposed
 * on window.__DDBStorage only; main.js aliases it and performs the
 * public window.Storage export at its own IIFE end so pre-existing
 * test stubs keep their exact clobber timing.
 */

"use strict";

/**
 * U-36: errors go to the themed, announced error toast instead of a blocking
 * native `alert()`. Resolved at call time; a bare boot logs rather than throws.
 * The name is unique per file because several modules are eval'd into ONE
 * shared scope in the test harness.
 */
const storageNotifyError = (msg) => {
  const w = typeof window !== "undefined" ? window : (typeof globalThis !== "undefined" ? globalThis : null);
  if (w && typeof w.showFeedback === "function") w.showFeedback(msg, "error");
  // AC-5: the ONE logger, resolved at call time.
  else if (w && typeof w.safeLog === "function") w.safeLog("error", "[DDB Print] " + msg);
};

  /**
   * Storage management for D&D Beyond Print Enhancer.
   * Uses IndexedDB to persist layout configurations and custom data.
   */
  const DB_NAME = "DDBPrintEnhancerDB";
  const DB_VERSION = 4;
  const STORE_NAME = "layouts";
  const SPELL_CACHE_STORE = "spell_cache";
  const CUSTOM_SHAPES_STORE = "custom_shapes";
  const SCHEMA_VERSION = "1.5.0";

  let db = null;

  const Storage = {
    SCHEMA_VERSION,
    initPromise: null,

    /**
     * Initialize the IndexedDB connection.
     */
    init: () => {
      if (db) return Promise.resolve(db);
      if (Storage.initPromise) return Storage.initPromise;

      Storage.initPromise = new Promise((resolve, reject) => {
        try {
          const request = indexedDB.open(DB_NAME, DB_VERSION);

          request.onblocked = () => {
            storageNotifyError(
              "Please close other tabs of D&D Beyond to allow the database to update.",
            );
            safeLog(
              "warn",
              "[DDB Print Enhance] IndexedDB open blocked. Other tabs might be holding a connection.",
            );
          };

          request.onerror = (event) => {
            const error = event.target.error;
            safeLog(
              "error",
              `[DDB Print Enhance] IndexedDB error (${error?.name}): ${error?.message}`,
            );
            Storage.initPromise = null; // Allow retry
            reject(error);
          };

          request.onupgradeneeded = (event) => {
            const upgradeDb = event.target.result;
            safeLog(
              "log",
              `[DDB Print Enhance] Upgrading IndexedDB to version ${DB_VERSION}...`,
            );
            if (!upgradeDb.objectStoreNames.contains(STORE_NAME)) {
              upgradeDb.createObjectStore(STORE_NAME, {
                keyPath: "characterId",
              });
            }
            if (!upgradeDb.objectStoreNames.contains(SPELL_CACHE_STORE)) {
              upgradeDb.createObjectStore(SPELL_CACHE_STORE, {
                keyPath: "name",
              });
            }
            if (!upgradeDb.objectStoreNames.contains(CUSTOM_SHAPES_STORE)) {
              upgradeDb.createObjectStore(CUSTOM_SHAPES_STORE, {
                keyPath: "id",
              });
            }
          };

          request.onsuccess = (event) => {
            db = event.target.result;

            db.onversionchange = () => {
              db.close();
              db = null;
              Storage.initPromise = null;
              safeLog(
                "warn",
                "[DDB Print Enhance] Database version changed elsewhere. Connection closed.",
              );
            };

            resolve(db);
          };
        } catch (err) {
          safeLog(
            "error",
            "[DDB Print Enhance] Critical error opening IndexedDB:",
            err,
          );
          Storage.initPromise = null;
          reject(err);
        }
      });

      return Storage.initPromise;
    },

    /**
     * Migrates layout data to the latest SCHEMA_VERSION.
     * @param {object} data
     * @returns {object}
     */
    migrateLayout: (data) => {
      if (!data) return data;

      const migrated = { ...data };

      // Ensure shapeLayers exists
      if (!migrated.shapeLayers) {
        migrated.shapeLayers = [];
      }

      // If shapeLayers is empty and it's a legacy version, migrate legacy data
      if (
        migrated.shapeLayers.length === 0 &&
        data.version !== SCHEMA_VERSION
      ) {
        const legacyShapes = data.shapes || [];
        const legacyShapeLayerState = data.layers?.shapes || {
          isLocked: false,
          isHidden: false,
        };

        migrated.shapeLayers.push({
          id: "shapes-default",
          name: "Default Shapes Layer",
          layerId: "print-enhance-shapes-layer",
          isLocked: legacyShapeLayerState.isLocked || false,
          isHidden: legacyShapeLayerState.isHidden || false,
          isDisabledOnPrint: legacyShapeLayerState.isDisabledOnPrint || false,
          elements: legacyShapes,
        });
      }

      // Final version update
      migrated.version = SCHEMA_VERSION;

      return migrated;
    },

    /**
     * Validates if the object matches the expected layout schema.
     * @param {object} data
     * @returns {boolean}
     */
    validateLayout: (data) => {
      if (!data || typeof data !== "object") return false;
      if (data.version === undefined || data.sections === undefined)
        return false;
      if (typeof data.sections !== "object") return false;
      return true;
    },

    /**
     * Save character layout data.
     * @param {string} characterId
     * @param {object} data - { characterId, sectionOrder, customSpells }
     */
    saveLayout: async (characterId, data) => {
      const database = await Storage.init();
      return new Promise((resolve, reject) => {
        const transaction = database.transaction([STORE_NAME], "readwrite");
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
    loadLayout: async (characterId) => {
      const database = await Storage.init();
      return new Promise((resolve, reject) => {
        const transaction = database.transaction([STORE_NAME], "readonly");
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(characterId);

        request.onsuccess = (event) =>
          resolve(Storage.migrateLayout(event.target.result));
        request.onerror = (event) => reject(event.target.error);
      });
    },

    /**
     * Save global layout data.
     * @param {object} data
     */
    saveGlobalLayout: (data) => {
      return Storage.saveLayout("GLOBAL", data);
    },

    /**
     * Load global layout data.
     * @returns {Promise<object|undefined>}
     */
    loadGlobalLayout: () => {
      return Storage.loadLayout("GLOBAL");
    },

    /**
     * Save global hue shift value.
     * @param {number} deg
     */
    saveHueShift: async (deg) => {
      const globalData = (await Storage.loadGlobalLayout()) || {
        version: SCHEMA_VERSION,
        sections: {},
      };
      globalData.hueShift = deg;
      return Storage.saveGlobalLayout(globalData);
    },

    /**
     * Get global hue shift value.
     * @returns {Promise<number>}
     */
    getHueShift: async () => {
      const globalData = await Storage.loadGlobalLayout();
      return globalData && globalData.hueShift !== undefined
        ? globalData.hueShift
        : 0;
    },

    /**
     * Save individual filter value.
     * @param {string} key - contrast, greyscale, saturate, sepia
     * @param {number} value
     */
    saveFilter: async (key, value) => {
      const globalData = (await Storage.loadGlobalLayout()) || {
        version: SCHEMA_VERSION,
        sections: {},
      };
      if (!globalData.filters) globalData.filters = {};
      globalData.filters[key] = value;
      return Storage.saveGlobalLayout(globalData);
    },

    /**
     * Get all global filters.
     * @returns {Promise<object>}
     */
    getFilters: async () => {
      const globalData = await Storage.loadGlobalLayout();
      const hue =
        globalData && globalData.hueShift !== undefined
          ? globalData.hueShift
          : 0;
      const defaults = {
        hue: hue,
        contrast: 100,
        greyscale: 100,
        saturate: 100,
        sepia: 0,
      };
      if (!globalData || !globalData.filters) return defaults;
      return { ...defaults, ...globalData.filters };
    },

    /**
     * Save a custom shape globally.
     * @param {object} shape {id, name, data}
     */
    saveCustomShape: async (shape) => {
      const database = await Storage.init();
      return new Promise((resolve, reject) => {
        const transaction = database.transaction(
          [CUSTOM_SHAPES_STORE],
          "readwrite",
        );
        const store = transaction.objectStore(CUSTOM_SHAPES_STORE);
        const request = store.put(shape);
        request.onsuccess = () => resolve();
        request.onerror = (event) => reject(event.target.error);
      });
    },

    /**
     * Get all globally saved custom shapes.
     * @returns {Promise<Array>}
     */
    getCustomShapes: async () => {
      const database = await Storage.init();
      return new Promise((resolve, reject) => {
        const transaction = database.transaction(
          [CUSTOM_SHAPES_STORE],
          "readonly",
        );
        const store = transaction.objectStore(CUSTOM_SHAPES_STORE);
        const request = store.getAll();
        request.onsuccess = (event) => resolve(event.target.result || []);
        request.onerror = (event) => reject(event.target.error);
      });
    },

    /**
     * Save multiple spells to the cache.
     * @param {Array} spells
     */
    saveSpells: async (spells) => {
      const database = await Storage.init();
      return new Promise((resolve, reject) => {
        const transaction = database.transaction(
          [SPELL_CACHE_STORE],
          "readwrite",
        );
        const store = transaction.objectStore(SPELL_CACHE_STORE);

        spells.forEach((spell) => store.put(spell));

        transaction.oncomplete = () => resolve();
        transaction.onerror = (event) => reject(event.target.error);
      });
    },

    /**
     * Get a spell from the cache by name.
     * @param {string} name
     * @returns {Promise<object|undefined>}
     */
    getSpell: async (name) => {
      const database = await Storage.init();
      return new Promise((resolve, reject) => {
        const transaction = database.transaction(
          [SPELL_CACHE_STORE],
          "readonly",
        );
        const store = transaction.objectStore(SPELL_CACHE_STORE);
        const request = store.get(name);

        request.onsuccess = (event) => resolve(event.target.result);
        request.onerror = (event) => reject(event.target.error);
      });
    },

    /**
     * Get all spells from the cache.
     * @returns {Promise<Array>}
     */
    getAllSpells: async () => {
      const database = await Storage.init();
      return new Promise((resolve, reject) => {
        const transaction = database.transaction(
          [SPELL_CACHE_STORE],
          "readonly",
        );
        const store = transaction.objectStore(SPELL_CACHE_STORE);
        const request = store.getAll();

        request.onsuccess = (event) => resolve(event.target.result);
        request.onerror = (event) => reject(event.target.error);
      });
    },
  };

// Expose the store/version constants on the Storage object so main.js
// reads them from the single source (AC-A3).
Object.assign(Storage, {
  DB_NAME,
  DB_VERSION,
  STORE_NAME,
  SPELL_CACHE_STORE,
  CUSTOM_SHAPES_STORE,
});

if (typeof module !== "undefined" && module.exports) {
  module.exports = Storage;
}
if (typeof window !== "undefined") {
  window.__DDBStorage = Storage;
}
