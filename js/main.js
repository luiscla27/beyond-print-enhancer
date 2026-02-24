/*
Licensed under Blue Oak Model License 1.0.0
*/

(function () {

/**
 * Storage management for D&D Beyond Print Enhancer.
 * Uses IndexedDB to persist layout configurations and custom data.
 */
const DB_NAME = 'DDBPrintEnhancerDB';
const DB_VERSION = 2;
const STORE_NAME = 'layouts';
const SPELL_CACHE_STORE = 'spell_cache';
const SCHEMA_VERSION = '1.2.0';

const DEFAULT_LAYOUTS = {
    "section-Section-1": {
      "left": "16px",
      "top": "160px",
      "width": "224px",
      "height": "144px",
      "zIndex": "10",
      "minimized": false,
      "compact": false,
      "borderStyle": null,
      "innerWidths": {}
    },
    "section-Section-2": {
      "left": "16px",
      "top": "576px",
      "width": "224px",
      "height": "144px",
      "zIndex": "103",
      "minimized": false,
      "compact": false,
      "borderStyle": null,
      "innerWidths": {
        "0-0": "224px"
      }
    },
    "section-Section-3": {
      "left": "16px",
      "top": "352px",
      "width": "224px",
      "height": "176px",
      "zIndex": "95",
      "minimized": false,
      "compact": false,
      "borderStyle": null,
      "innerWidths": {
        "0-0": "224px"
      }
    },
    "section-Section-4": {
      "left": "288px",
      "top": "160px",
      "width": "176px",
      "height": "560px",
      "zIndex": "10",
      "minimized": false,
      "compact": false,
      "borderStyle": null,
      "innerWidths": {}
    },
    "section-Section-5": {
      "left": "704px",
      "top": "160px",
      "width": "480px",
      "height": "128px",
      "zIndex": "126",
      "minimized": false,
      "compact": false,
      "borderStyle": null,
      "innerWidths": {
        "0-0": "480px"
      }
    },
    "section-Section-6": {
      "left": "496px",
      "top": "144px",
      "width": "160px",
      "height": "160px",
      "zIndex": "136",
      "minimized": false,
      "compact": false,
      "borderStyle": "spikes_border",
      "innerWidths": {}
    },
    "section-Actions": {
      "left": "512px",
      "top": "336px",
      "width": "672px",
      "height": "1312px",
      "zIndex": "110",
      "minimized": false,
      "compact": false,
      "borderStyle": null,
      "innerWidths": {}
    },
    "section-Spells": {
      "left": "512px",
      "top": "1712px",
      "width": "672px",
      "height": "832px",
      "zIndex": "10",
      "minimized": false,
      "compact": false,
      "borderStyle": null,
      "innerWidths": {}
    },
    "section-Inventory": {
      "left": "512px",
      "top": "3712px",
      "width": "672px",
      "height": "1920px",
      "zIndex": "10",
      "minimized": false,
      "compact": false,
      "borderStyle": null,
      "innerWidths": {}
    },
    "section-Features_&_Traits": {
      "left": "16px",
      "top": "1712px",
      "width": "448px",
      "height": "1952px",
      "zIndex": "10",
      "minimized": false,
      "compact": false,
      "borderStyle": null,
      "innerWidths": {}
    },
    "section-Background": {
      "left": "512px",
      "top": "2592px",
      "width": "672px",
      "height": "1072px",
      "zIndex": "10",
      "minimized": false,
      "compact": false,
      "borderStyle": null,
      "innerWidths": {}
    },
    "section-Notes": {
      "left": "16px",
      "top": "768px",
      "width": "448px",
      "height": "896px",
      "zIndex": "10",
      "minimized": false,
      "compact": false,
      "borderStyle": null,
      "innerWidths": {}
    },
    "section-Extras": {
      "left": "16px",
      "top": "3712px",
      "width": "448px",
      "height": "1920px",
      "zIndex": "10",
      "minimized": false,
      "compact": false,
      "borderStyle": null,
      "innerWidths": {}
    },
    "section-Quick-Info": {
      "left": "880px",
      "top": "272px",
      "width": "272px",
      "height": "128px",
      "zIndex": "76",
      "minimized": false,
      "compact": false,
      "borderStyle": "no-border",
      "innerWidths": {}
    },
    "section-Ability-Ability 1": {
      "left": "16px",
      "top": "16px",
      "width": "80px",
      "height": "96px",
      "zIndex": "37",
      "minimized": false,
      "compact": false,
      "borderStyle": "ability_border",
      "innerWidths": {
        "0-0": "100%"
      }
    },
    "section-Ability-Ability 2": {
      "left": "576px",
      "top": "16px",
      "width": "80px",
      "height": "96px",
      "zIndex": "47",
      "minimized": false,
      "compact": false,
      "borderStyle": "ability_border",
      "innerWidths": {
        "0-0": "100%"
      }
    },
    "section-Ability-Ability 3": {
      "left": "464px",
      "top": "16px",
      "width": "80px",
      "height": "96px",
      "zIndex": "43",
      "minimized": false,
      "compact": false,
      "borderStyle": "ability_border",
      "innerWidths": {
        "0-0": "100%"
      }
    },
    "section-Ability-Ability 4": {
      "left": "128px",
      "top": "16px",
      "width": "80px",
      "height": "96px",
      "zIndex": "39",
      "minimized": false,
      "compact": false,
      "borderStyle": "ability_border",
      "innerWidths": {
        "0-0": "100%"
      }
    },
    "section-Ability-Ability 5": {
      "left": "240px",
      "top": "16px",
      "width": "80px",
      "height": "96px",
      "zIndex": "41",
      "minimized": false,
      "compact": false,
      "borderStyle": "ability_border",
      "innerWidths": {
        "0-0": "100%"
      }
    },
    "section-Ability-Ability 6": {
      "left": "352px",
      "top": "16px",
      "width": "80px",
      "height": "96px",
      "zIndex": "42",
      "minimized": false,
      "compact": false,
      "borderStyle": "ability_border",
      "innerWidths": {
        "0-0": "100%"
      }
    },
    "section-Box-Box-1": {
      "left": "672px",
      "top": "16px",
      "width": "96px",
      "height": "96px",
      "zIndex": "120",
      "minimized": false,
      "compact": false,
      "borderStyle": "box_border",
      "innerWidths": {
        "0-0": "96px"
      }
    },
    "section-Box-Box-2": {
      "left": "784px",
      "top": "16px",
      "width": "96px",
      "height": "96px",
      "zIndex": "135",
      "minimized": false,
      "compact": false,
      "borderStyle": "box_border",
      "innerWidths": {
        "0-0": "96px"
      }
    },
    "section-Quick-Info-Health": {
      "left": "896px",
      "top": "16px",
      "width": "288px",
      "height": "96px",
      "zIndex": "134",
      "minimized": false,
      "compact": false,
      "borderStyle": "box_border",
      "innerWidths": {}
    }
};

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
        if (!db.objectStoreNames.contains(SPELL_CACHE_STORE)) {
          db.createObjectStore(SPELL_CACHE_STORE, { keyPath: 'name' });
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
  },

  /**
   * Save global layout data.
   * @param {object} data 
   */
  saveGlobalLayout: (data) => {
    return Storage.saveLayout('GLOBAL', data);
  },

  /**
   * Load global layout data.
   * @returns {Promise<object|undefined>}
   */
  loadGlobalLayout: () => {
    return Storage.loadLayout('GLOBAL');
  },

  /**
   * Save multiple spells to the cache.
   * @param {Array} spells 
   */
  saveSpells: (spells) => {
    return new Promise((resolve, reject) => {
      if (!db) return reject(new Error('Database not initialized'));

      const transaction = db.transaction([SPELL_CACHE_STORE], 'readwrite');
      const store = transaction.objectStore(SPELL_CACHE_STORE);
      
      spells.forEach(spell => store.put(spell));

      transaction.oncomplete = () => resolve();
      transaction.onerror = (event) => reject(event.target.error);
    });
  },

  /**
   * Get a spell from the cache by name.
   * @param {string} name 
   * @returns {Promise<object|undefined>}
   */
  getSpell: (name) => {
    return new Promise((resolve, reject) => {
      if (!db) return reject(new Error('Database not initialized'));

      const transaction = db.transaction([SPELL_CACHE_STORE], 'readonly');
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
  getAllSpells: () => {
    return new Promise((resolve, reject) => {
      if (!db) return reject(new Error('Database not initialized'));

      const transaction = db.transaction([SPELL_CACHE_STORE], 'readonly');
      const store = transaction.objectStore(SPELL_CACHE_STORE);
      const request = store.getAll();

      request.onsuccess = (event) => resolve(event.target.result);
      request.onerror = (event) => reject(event.target.error);
    });
  }
};

/**
 * Navigate to a specific character sheet section (tab).
 */
function navToSection(name) {
  const dom = window.DomManager.getInstance();
  const tabs = dom.selectors.CORE.TAB_BUTTON ? 
               Array.from(document.querySelectorAll(dom.selectors.CORE.TAB_BUTTON)) : [];
  
  let target = tabs.find(tab => tab.textContent.toLowerCase().includes(name.toLowerCase()));
  
  // Minimal fallback: if not found in specific class, look in all buttons if allowed by user rules (removing brittle logic implies usage of DomManager primarily)
  // But to be safe if 'tabButton' class changes, we might want to check generic buttons? 
  // For now, strict DomManager usage as per plan.
  
  if (target) {
      console.log(`[DDB Print Enhance] Navigating to: ${name}`);
      target.click();
      return target;
  }
  
  console.error(`[DDB Print Enhance] Could not find tab for section: ${name}`);
  return null;
}

/**
 * Helper to identify the base selector for an element
 */
function getBaseSelector(el) {
    const dom = window.DomManager.getInstance();
    const s = dom.selectors.EXTRACTABLE;
    // We match the pattern from DomManager selector strings
    // Assumption: The selector string IS the class selector.
    // We can extract the class name from the selector string (e.g. '[class*="-group"]' -> '-group')
    // Or just use the selector string itself as the source of truth for the regex if possible?
    // Let's use the explicit constants to build the regex logic if user insists on "no strings".
    // "No css selector" implies string literals.
    
    // We can derive regex from the selector string if it follows '[class*="pattern"]'
    const getPattern = (sel) => {
        const match = sel.match(/class\*="([^"]+)"/);
        return match ? new RegExp(match[1] + '$') : null;
    };
    
    // Or we just map them manually since regex logic is code, not selector string.
    // The "string" in the code below is the key from DomManager, or we construct the target object using DomManager values.
    
    const targets = [
        { pattern: /-group$/, selector: s.GROUP },
        { pattern: /-snippet--class$/, selector: s.SNIPPET_CLASS },
        { pattern: /^styles_actionsList__/, selector: s.ACTIONS_LIST },
        { pattern: /^styles_attackTable__/, selector: s.ATTACK_TABLE },
        { pattern: /__traits$/, selector: s.TRAITS }
    ];

    const classes = Array.from(el.classList);
    for (const target of targets) {
        if (classes.some(c => c !== 'be-extractable' && target.pattern.test(c))) {
            return target.selector;
        }
    }
    return null;
}

/**
 * Helper to get a stable unique selector for extraction.
 * @param {HTMLElement} el The element to identify.
 * @param {boolean} includeContainers If true, includes elements inside .print-section-container.
 */
function getExtractionSelector(el, includeContainers = false) {
    const idClass = Array.from(el.classList).find(c => c.startsWith('be-ext-'));
    const selector = idClass ? `.${idClass}.be-extractable` : getBaseSelector(el);
    if (!selector) return null;

    let matches = Array.from(document.querySelectorAll(selector));
    if (!includeContainers) {
        matches = matches.filter(m => !m.closest('.print-section-container'));
    }
    const index = matches.indexOf(el);
    
    if (index !== -1) {
        return { selector, index };
    }
    return null;
}

/**
 * Creates a standard draggable container for extracted content.
 */
function createDraggableContainer(title, content, id) {
  const container = document.createElement('div');
  container.className = 'print-section-container';
  container.id = id;
  // REMOVED: container.setAttribute('draggable', 'true');
  
  const header = document.createElement('div');
  header.className = 'print-section-header';
  
  const titleSpan = document.createElement('span');
  titleSpan.textContent = title;
  header.appendChild(titleSpan);

  header.setAttribute('draggable', 'true');
  
  header.style.fontWeight = 'bold';
  header.style.fontSize = '18px';
  header.style.display = 'flex';
  header.style.justifyContent = 'space-between';
  header.style.alignItems = 'center';

  // Minimize button
  const minimizeBtn = document.createElement('button');
  minimizeBtn.textContent = 'X';
  minimizeBtn.className = 'print-section-minimize';
  minimizeBtn.style.cursor = 'pointer';
  minimizeBtn.style.background = 'none';
  minimizeBtn.style.border = 'none';
  minimizeBtn.style.padding = '0 5px';
  minimizeBtn.style.fontWeight = 'bold';
  minimizeBtn.onclick = (e) => {
      e.stopPropagation();
      container.classList.add('minimized');
  };
  header.appendChild(minimizeBtn);

  container.appendChild(header);
  
  // Restore button (only visible when minimized)
  const restoreBtn = document.createElement('button');
  restoreBtn.textContent = 'R';
  restoreBtn.className = 'print-section-restore';
  restoreBtn.style.display = 'none';
  restoreBtn.style.width = '100%';
  restoreBtn.style.height = '100%';
  restoreBtn.style.cursor = 'pointer';
  restoreBtn.style.padding = '0';
  restoreBtn.style.fontSize = '12px';
  restoreBtn.style.fontWeight = 'bold';
  restoreBtn.onclick = (e) => {
      e.stopPropagation();
      container.classList.remove('minimized');
  };
  container.appendChild(restoreBtn);

  const contentWrapper = document.createElement('div');
  contentWrapper.className = 'print-section-content';
  contentWrapper.appendChild(content);
  container.appendChild(contentWrapper);
  
  return container;
}

/**
 * Sleep helper for async flows.
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Collect content from all tabs and wrap them in draggable containers.
 */
/**
 * Collect content from all tabs and wrap them in draggable containers.
 */
async function extractAndWrapSections() {
    const dom = window.DomManager.getInstance();
    
    // Strategy: Identify sections by looking for tab buttons using DomManager
    // We strictly use the defined selectors, no more fallbacks to hardcoded lists.
    let tabs = [];
    if (dom.selectors.CORE.TAB_BUTTON) {
        tabs = Array.from(document.querySelectorAll(dom.selectors.CORE.TAB_BUTTON));
    }
    
    // If no tabs found, we can't extract dynamic sections.
    if (tabs.length === 0) {
        console.warn('[DDB Print] No tabs found using DomManager selectors. Extraction aborted.');
        return [];
    }

    const sectionsToExtract = tabs.map(t => ({
        name: t.textContent.trim(),
        title: t.textContent.trim(),
        testId: t.getAttribute('data-testid')
    })).filter(s => s.name);

    const extractedContainers = [];

    for (const section of sectionsToExtract) {
        const target = navToSection(section.name);
        
        // Give React time to render. Using Promise-based delay to be safe.
        await new Promise(r => setTimeout(r, 100));

        if (target) { 
            // Priority: Find the main structural container that holds the styles
            // We use DomManager selectors
            const selectors = [
                dom.selectors.CORE.PRIMARY_BOX_WRAPPER,
                dom.selectors.UI.PRIMARY_BOX,
                // Removed specific fallbacks as per user request to have NO CSS strings in main.js
            ];
            
            // Helper to find visible element among matches
            let content = null;
            for (const selector of selectors) {
                if (!selector) continue;
                const matches = document.querySelectorAll(selector);
                // Find one that is not hidden.
                const visibleMatch = Array.from(matches).find(el => {
                    const style = window.getComputedStyle(el);
                    return style.display !== 'none' && !el.classList.contains('hidden');
                });
                
                if (visibleMatch) {
                    content = visibleMatch;
                    break;
                }
            }

            if (content) {
                // Refinement: If we matched a child but the parent is the actual styled container, go up.
                if (content.parentElement && (
                    content.parentElement.className.includes('primaryBox') ||
                    content.parentElement.className.includes('ct-primary-box')
                )) {
                    content = content.parentElement;
                }

            // User Request: DONT clone the "spells" tab (keep it live/interactive)
                // Fix: Skip Spells in the loop to avoid breaking iteration.
                // Strict Check: Use data-testid="SPELLS" if available, or name fallback
                if (section.name.includes('Spells') || section.title.includes('Spells') || section.testId === 'SPELLS') {
                    console.log('[DDB Print] Skipping Spells in main loop (will handle deferred/live)');
                    continue;
                }

                const nodeToWrap = content.cloneNode(true);
                
                const clone = nodeToWrap; // Alias for existing logic compliance
                
                // Ensure the content is visible (it might be hidden if tab wasn't active)
                clone.style.display = '';
                clone.classList.remove('hidden'); // Remove potential utility classes for hiding

                
                // Cleanup: Remove unwanted elements from the clone
                // 1. Hide <menu> tags (often used for popups/context)
                clone.querySelectorAll('menu').forEach(el => el.style.display = 'none');
                
                // 2. Hide specific filters
                clone.querySelectorAll('[data-testid="tab-filters"]').forEach(el => el.style.display = 'none');
                
                // 3. Layout Fix: Remove Scrollbars & Fixed Heights
                // Force the container and its children to expand
                // User Request: height: fit-content !important; display: flex !important;
                clone.style.cssText += 'height: fit-content !important; display: flex !important; flex-direction: column !important; max-height: none !important; overflow: visible !important;';
                
                // Apply similar logic to internal sections that might assume fixed height
                clone.querySelectorAll('section, .ct-primary-box').forEach(el => {
                    el.style.cssText += 'height: fit-content !important; display: flex !important; flex-direction: column !important; max-height: none !important; overflow: visible !important;';
                });

                // Targeted SVG Removal: Use helper function
                removeSpecificSvgs(clone);

                // RE-ENABLED: Fix Background SVGs to stretch for non-border backgrounds
                const bgSvgs = clone.querySelectorAll([
                    dom.selectors.UI.PRIMARY_BOX + ' > ' + dom.selectors.SVG.ALL,
                    dom.selectors.SVG.REP_BOX,
                    dom.selectors.SVG.BOX_BACKGROUND + ':not([style*="display: none"]) ' + dom.selectors.SVG.ALL
                ].join(', '));
                
                bgSvgs.forEach(svg => {
                    svg.style.height = '100%';
                    svg.style.width = '100%';
                    if(svg.hasAttribute('height')) svg.removeAttribute('height');
                    if(svg.hasAttribute('width')) svg.removeAttribute('width');
                    svg.setAttribute('preserveAspectRatio', 'none');
                });
                
                // Explicitly fix Group Boxes (Proficiency, Skills, Senses, Saving Throws)
                const groupBoxSvgs = clone.querySelectorAll([
                    dom.selectors.SVG.PROFICIENCY,
                    dom.selectors.SVG.SENSES,
                    dom.selectors.SVG.SKILLS,
                    dom.selectors.SVG.SAVING_THROWS
                ].join(', '));
                groupBoxSvgs.forEach(svg => {
                        svg.setAttribute('preserveAspectRatio', 'none');
                        svg.style.width = '100%';
                        svg.style.height = '100%';
                });
                
                // Also target potential internal scrolling containers
                clone.querySelectorAll('*').forEach(el => {
                    const tag = el.tagName.toLowerCase();
                    if (tag === 'svg' || tag === 'g' || tag === 'path' || tag === 'symbol' || tag === 'defs') return;

                    const style = window.getComputedStyle(el);
                        if (style.overflow === 'auto' || style.overflow === 'scroll' || style.maxHeight !== 'none') {
                            el.style.maxHeight = 'none';
                            el.style.overflow = 'visible';
                        }
                });

                // Create a clean wrapper for the print layout
                const wrapper = document.createElement('div');
                // We do NOT blindly copy parent classes here because we just cloned the PROPER container.
                // But we can add a helper class.
                wrapper.className = 'print-section-wrapper';
                wrapper.appendChild(clone);

                extractedContainers.push(createDraggableContainer(
                    section.title, 
                    wrapper, 
                    `section-${section.name.replace(/\s+/g, '_')}`
                ));
            } else {
                    console.warn(`[DDB Print] Content content not found for section: ${section.name}`);
            }
        }
    }


  return extractedContainers;
}

/**
 * Removes specific SVGs as requested by the user.
 * 1. First .ddbc-box-background
 * 2. All section > div > svg
 */
function removeSpecificSvgs(container) {
    if (window.__MOCK_REMOVE_SPECIFIC_SVGS__) {
        window.__MOCK_REMOVE_SPECIFIC_SVGS__(container);
        return;
    }
    if (!container) return;

    const dom = window.DomManager.getInstance();
    const s = dom.selectors.SVG;

    // 1. Remove first .ddbc-box-background
    const firstBg = container.querySelector(s.BOX_BACKGROUND);
    if (firstBg) {
        // User Request: Don't hide the background if it belongs to Armor Class or Initiative
        const isProtected = firstBg.querySelector(s.ARMOR_CLASS + ', ' + s.INITIATIVE) ||
                            firstBg.closest(s.ARMOR_CLASS_BOX + ', ' + s.INITIATIVE_BOX);
        
        if (!isProtected) {
            firstBg.style.display = 'none';
        }
    }

    // 2. Remove all section > div > svg
    // Check nested instances
    container.querySelectorAll(s.GENERIC_SECTION).forEach(svg => {
        if (!svg.classList.contains(s.ARMOR_CLASS.replace('.', '')) && !svg.classList.contains(s.INITIATIVE.replace('.', ''))) {
            svg.style.display = 'none';
        }
    });
    
    // Check if container itself matches section > div > svg pattern (e.g. if container is section)
    if (container.tagName === 'SECTION') {
        container.querySelectorAll(':scope > div > ' + s.ALL).forEach(svg => {
             if (!svg.classList.contains(s.ARMOR_CLASS.replace('.', '')) && !svg.classList.contains(s.INITIATIVE.replace('.', ''))) {
                svg.style.display = 'none';
            }
        });
    }
}

/**
 * Appends all collected sections to the main sheet view.
 */
/**
 * Copies SVG definitions to the print wrapper to ensure icons render.
 */
function copySvgDefinitions(targetContainer) {
    // Find all SVGs that might contain definitions (defs/symbol)
    // Find all SVGs that might contain definitions (defs/symbol)
    const dom = window.DomManager.getInstance();
    const svgs = document.querySelectorAll(dom.selectors.SVG.ALL);
    svgs.forEach(svg => {
        if (svg.querySelector(dom.selectors.SVG.DEFS.replace('svg ', '')) || svg.style.display === 'none') {
            const clone = svg.cloneNode(true);
            clone.style.display = 'none'; // Ensure it doesn't take up space
            targetContainer.appendChild(clone);
        }
    });
}

/**
 * Appends all collected sections to the main sheet view.
 */
/**
 * Injects detail section triggers into spell rows.
 */
function injectSpellDetailTriggers(context = document) {
    let rows;
    if (window.DomManager) {
        // If context is an ElementWrapper, DomManager handles it
        // If context is raw HTMLElement, we can wrap it or pass it if DomManager supports
        // Our getSpellRows supports HTMLElement context
        rows = window.DomManager.getInstance().getSpellRows(context).map(w => w.element);
    } else {
        rows = context.querySelectorAll('.ct-spells-spell');
    }

    rows.forEach(row => {
        if (row.querySelector('.be-spell-details-button')) return;

        const label = row.querySelector('.ct-spells-spell__label');
        if (!label) return;

        const spellName = label.textContent.trim();
        
        const btn = document.createElement('button');
        btn.className = 'be-spell-details-button';
        btn.innerText = 'Details';
        btn.onclick = (e) => {
            e.stopPropagation();
            // Coordinates for floating section
            const coords = { x: e.clientX, y: e.clientY, pageX: e.pageX, pageY: e.pageY };
            if (window.createSpellDetailSection) {
                window.createSpellDetailSection(spellName, coords);
            } else {
                console.log(`[DDB Print] Details clicked for ${spellName} at`, coords);
            }
        };

        row.appendChild(btn);
    });
}

/**
 * Scans the DOM for elements that match extraction criteria and flags them.
 * Implements Top-Down Priority: nested matching elements are ignored.
 */
/**
 * Scans the DOM for elements that match extraction criteria and flags them.
 * Implements Top-Down Priority: nested matching elements are ignored.
 * Also injects a unique-ish class based on content for stable persistence.
 */
function flagExtractableElements() {
    const dom = window.DomManager.getInstance();
    const s = dom.selectors.EXTRACTABLE;
    const selectors = [
        s.GROUP,
        s.SNIPPET_CLASS,
        s.ACTIONS_LIST,
        s.ATTACK_TABLE,
        s.TRAITS
    ];

    const elements = Array.from(document.querySelectorAll(selectors.join(', ')));
    
    elements.forEach(el => {
        // Nesting logic: Top-Down Priority.
        // Check if any matching element strictly contains this one.
        const isNested = elements.some(other => {
            return other !== el && other.contains(el);
        });

        if (!isNested) {
            el.classList.add('be-extractable');
            
            // Generate and add an extraction-specific identification class
            let title = findSectionTitle(el);
            if (!title) {
                title = el.textContent.trim().substring(0, 8);
            }
            
            if (title) {
                const sanitized = title.toLowerCase()
                    .replace(/[^a-z0-9]+/g, '_')
                    .replace(/^_+|_+$/g, '');
                
                const idClass = `be-ext-${sanitized || 'content'}`;
                el.classList.add(idClass);
            }

            // Attach extraction listener
            el.ondblclick = async (e) => {
                e.stopPropagation();
                await handleElementExtraction(el);
            };
        }
    });
}

/**
 * Handles the extraction of an element into a new floating section.
 */
async function handleElementExtraction(el) {
    // 1. Ensure original has an ID for tracking
    if (!el.id) {
        el.id = `be-auto-id-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    }

    // 2. Discover Title
    let title = findSectionTitle(el);
    if (!title) {
        title = await (window.showInputModal || showInputModal)('Extract Content', 'No title found. Enter a name for this section:', 'Extracted Section');
        if (!title) return; // User cancelled
    }

    // 3. Clone content
    const sanitizedClone = getSanitizedContent(el);
    const clone = sanitizedClone; // Alias for existing logic compliance
    clone.style.display = ''; // Ensure clone is visible
    clone.classList.remove('be-extractable'); // Avoid nested triggers in clone
    
    // Hide original header/title inside the clone to avoid duplication
    const originalHeader = clone.querySelector('h1, h2, h3, h4, h5, [class*="head"]');
    if (originalHeader) {
        originalHeader.style.display = 'none';
    }
    
    // Create section content using a DocumentFragment to avoid extra intermediate DIVs
    const fragment = document.createDocumentFragment();

    // Standardized header
    const header = document.createElement('div');
    header.className = 'ct-content-group__header';
    const headerContent = document.createElement('div');
    headerContent.className = 'ct-content-group__header-content';
    headerContent.textContent = title;
    header.appendChild(headerContent);
    fragment.appendChild(header);

    // If it's a merge wrapper, we take its children to avoid redundant DIV nesting
    if (clone.classList.contains('be-merge-wrapper')) {
        while (clone.firstChild) {
            fragment.appendChild(clone.firstChild);
        }
    } else {
        fragment.appendChild(clone);
    }

    // 4. Create floating section
    const sectionId = `extracted-section-${Date.now()}`;
    const container = createDraggableContainer(title, fragment, sectionId);
    container.classList.add('be-extracted-section');
    container.dataset.originalId = el.id;

    // Store parent section ID for "Apply to all" and grouping logic
    const s = window.DomManager.getInstance().selectors;
    const parentSection = el.closest(`${s.UI.SUBSECTION}, ${s.UI.SECTION}`);
    if (parentSection) {
        container.dataset.parentSectionId = parentSection.id;
    }
    
    // Store identification class for future merges
    const idClass = Array.from(el.classList).find(c => c.startsWith('be-ext-'));
    if (idClass) container.dataset.beExtClass = idClass;

    // 5. Customize Close Button for Rollback
    const xBtn = container.querySelector('.print-section-minimize');
    if (xBtn) {
        xBtn.title = 'Rollback Extraction';
        xBtn.onclick = (e) => {
            e.stopPropagation();
            rollbackSection(container);
        };
    }

    // 6. Position and Hide Original
    const rect = el.getBoundingClientRect();
    const layoutRoot = document.getElementById('print-layout-wrapper') || document.body;
    const rootRect = layoutRoot.getBoundingClientRect();
    
    container.style.position = 'absolute';
    container.style.left = `${rect.left - rootRect.left + rect.width + 20}px`; // To the right of original
    container.style.top = `${rect.top - rootRect.top}px`;
    container.style.width = `${rect.width}px`;
    container.style.height = 'auto';
    container.style.zIndex = '10000';

    layoutRoot.appendChild(container);
    
    // In the case of spell sections, destroy original instead of hiding
    // (They are ephemeral and don't have a home on the sheet to rollback to)
    const isSpell = el.classList.contains('be-spell-detail') || 
                    el.id.startsWith('spell-detail-') || 
                    el.querySelector('[data-be-spell-merge]');

    if (isSpell) {
        el.remove();
    } else {
        el.style.setProperty('display', 'none', 'important');
    }
    
    if (window.injectCloneButtons) window.injectCloneButtons(container);
    if (window.injectAppendButton) window.injectAppendButton(container);
    if (window.initResizeLogic) window.initResizeLogic();
    updateLayoutBounds();
    showFeedback(`Extracted ${title}`);

    return container;
}

/**
 * Renders an extracted section from a snapshot.
 */
function renderExtractedSection(snapshot) {
    // 1. Resolve the original element
    let original = document.getElementById(snapshot.originalId);
    
    // If ID lookup fails (common on reloads), use the selector path
    if (!original && snapshot.selector && snapshot.index !== undefined) {
        const matches = document.querySelectorAll(snapshot.selector);
        original = matches[snapshot.index];
        // Re-assign the ID if found so rollback works
        if (original) {
            original.id = snapshot.originalId;
        }
    }

    if (!original) {
        console.warn(`[DDB Print] Could not resolve original for extraction: ${snapshot.title}`);
        return null;
    }

    // 2. Clone LIVE content
    const sanitizedClone = getSanitizedContent(original);
    const sourceElement = sanitizedClone; // Alias for existing logic compliance
    sourceElement.style.display = ''; 
    sourceElement.classList.remove('be-extractable');
    
    // Hide original title inside the live clone to avoid duplication
    const originalHeader = sourceElement.querySelector('h1, h2, h3, h4, h5, [class*="head"]');
    if (originalHeader) {
        originalHeader.style.display = 'none';
    }

    // 3. Assemble standardized header
    const fragment = document.createDocumentFragment();
    const header = document.createElement('div');
    header.className = 'ct-content-group__header';
    const headerContent = document.createElement('div');
    headerContent.className = 'ct-content-group__header-content';
    headerContent.textContent = snapshot.title;
    header.appendChild(headerContent);

    fragment.appendChild(header);
    
    // Promote children if it's a merge wrapper, otherwise append the clone
    if (sourceElement.classList.contains('be-merge-wrapper')) {
        while (sourceElement.firstChild) {
            fragment.appendChild(sourceElement.firstChild);
        }
    } else {
        fragment.appendChild(sourceElement);
    }

    const container = createDraggableContainer(snapshot.title, fragment, snapshot.id);
    container.classList.add('be-extracted-section');
    container.dataset.originalId = snapshot.originalId;
    if (snapshot.parentSectionId) {
        container.dataset.parentSectionId = snapshot.parentSectionId;
    }
    if (snapshot.borderStyle) {
        container.classList.add(snapshot.borderStyle);
    }
    
    // Restore identification class for future merges
    if (snapshot.selector) {
        const idClass = snapshot.selector.split('.')[1]; // .be-ext-xxx.be-extractable -> be-ext-xxx
        if (idClass) container.dataset.beExtClass = idClass;
    }

    // 4. Link rollback logic
    const xBtn = container.querySelector('.print-section-minimize');
    if (xBtn) {
        xBtn.title = 'Rollback Extraction';
        xBtn.onclick = (e) => {
            e.stopPropagation();
            rollbackSection(container);
        };
    }

    // 5. Hide original in DOM
    original.style.setProperty('display', 'none', 'important');

    // 6. Apply styles
    if (snapshot.width) container.style.setProperty('width', snapshot.width, 'important');
    if (snapshot.height) container.style.setProperty('height', snapshot.height, 'important');
    if (snapshot.left) container.style.setProperty('left', snapshot.left, 'important');
    if (snapshot.top) container.style.setProperty('top', snapshot.top, 'important');
    if (snapshot.zIndex) container.style.setProperty('z-index', snapshot.zIndex, 'important');

    if (snapshot.minimized) {
        container.dataset.minimized = 'true';
        container.classList.add('minimized');
    }

    if (snapshot.compact) {
        container.classList.add('be-compact-mode');
    }

    const layoutRoot = document.getElementById('print-layout-wrapper') || document.body;
    layoutRoot.appendChild(container);
    
    if (window.injectCloneButtons) window.injectCloneButtons(container);
    if (window.injectAppendButton) window.injectAppendButton(container);
    if (window.initResizeLogic) window.initResizeLogic();
    
    return container;
}

/**
 * Basic title discovery (to be refined in Phase 3).
 */
function findSectionTitle(el) {
    const dom = window.DomManager.getInstance();
    const titleEl = el.querySelector(dom.selectors.EXTRACTABLE.HEADER_GENERIC);
    return titleEl ? titleEl.textContent.trim() : null;
}

/**
 * Sanitizes a content node by removing extension UI elements and preventing header duplication.
 * @param {HTMLElement} node The node to sanitize.
 * @returns {HTMLElement} A sanitized clone of the node.
 */
function getSanitizedContent(node) {
    const clone = node.cloneNode(true);
    const dom = window.DomManager.getInstance();
    const toRemove = [
        '.be-clone-button',
        '.be-compact-button',
        '.be-append-button',
        '.be-section-actions',
        '.print-section-minimize',
        '.print-section-restore',
        '.print-section-resize-handle',
        dom.selectors.SPELLS.FILTER_CLASS,
        dom.selectors.UI.MENU
    ];

    toRemove.forEach(selector => {
        clone.querySelectorAll(selector).forEach(el => el.remove());
    });

    // Prevent header duplication: remove top-level standardized headers
    // because new ones are added when wrapping/rendering.

    if (window.DomManager) {
        const dom = window.DomManager.getInstance();
        const existingHeaders = clone.querySelectorAll(':scope > ' + dom.selectors.EXTRACTABLE.CONTENT_GROUP_HEADER);
        existingHeaders.forEach(h => h.remove());
    }

    return clone;
}

/**
 * Gathers all potential merge targets and their display names.
 * Targets include .be-extractable (on sheet) and .be-extracted-section (floating).
 */
function getMergeTargets() {
    const targets = [];

    // 1. Sheet Targets (be-extractable)
    document.querySelectorAll('.be-extractable').forEach(el => {
        // Find parent section for breadcrumb
        const parentSection = el.closest('.print-section-container');
        let sectionName = 'Sheet';
        if (parentSection) {
            const header = parentSection.querySelector('.print-section-header span');
            sectionName = header ? header.textContent.trim() : 'Section';
        }

        const itemName = findSectionTitle(el) || el.textContent.trim().substring(0, 20);
        targets.push({
            type: 'sheet',
            id: el.id,
            name: `${sectionName} > ${itemName}`,
            element: el
        });
    });

    // 2. Floating Targets (be-extracted-section)
    document.querySelectorAll('.print-section-container.be-extracted-section').forEach(el => {
        const header = el.querySelector('.print-section-header span');
        const itemName = header ? header.textContent.trim() : 'Extracted Section';
        
        // Find the inner standardized header if it exists for extra detail
        const subHeader = el.querySelector('.ct-content-group__header-content');
        const detail = subHeader ? ` (${subHeader.textContent.trim()})` : '';

        targets.push({
            type: 'section',
            id: el.id,
            name: `Floating: ${itemName}${detail}`,
            element: el
        });
    });

    return targets;
}

/**
 * Injects an "Append after" button into an extracted section's header.
 */
function injectAppendButton(container) {
    const actionContainer = getOrCreateActionContainer(container);
    if (actionContainer.querySelector('.be-append-button')) return;

    const btn = document.createElement('button');
    btn.className = 'be-append-button';
    btn.innerHTML = '🔗';
    btn.title = 'Append after...';
    
    btn.onclick = async (e) => {
        e.stopPropagation();
        const targets = getMergeTargets().filter(t => t.element !== container);
        if (targets.length === 0) {
            showFeedback('No available targets found');
            return;
        }

        const selectedTarget = await showTargetSelectionModal(targets);
        if (selectedTarget) {
            handleMergeSections(container, selectedTarget);
        }
    };

    actionContainer.appendChild(btn);
}

/**
 * Shows a modal to select a merge target.
 */
function showTargetSelectionModal(targets) {
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.className = 'be-modal-overlay';
        overlay.style.zIndex = '30000'; // Higher than floating sections
        
        const modal = document.createElement('div');
        modal.className = 'be-modal';
        modal.style.width = '500px';
        modal.style.maxHeight = '80vh';
        modal.style.overflowY = 'auto';
        
        const h3 = document.createElement('h3');
        h3.textContent = 'Select Append Target';
        modal.appendChild(h3);

        const list = document.createElement('div');
        list.style.display = 'flex';
        list.style.flexDirection = 'column';
        list.style.gap = '5px';
        list.style.marginTop = '15px';

        targets.forEach(target => {
            const btn = document.createElement('button');
            btn.textContent = target.name;
            const dom = window.DomManager.getInstance();
            btn.className = dom.selectors.CORE.THEME_BUTTON.substring(1);
            btn.style.textAlign = 'left';
            btn.style.padding = '8px 12px';
            btn.style.width = '100%';
            btn.onclick = () => {
                overlay.remove();
                resolve(target);
            };
            list.appendChild(btn);
        });

        modal.appendChild(list);

        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'Cancel';
        cancelBtn.className = 'be-modal-cancel';
        cancelBtn.style.marginTop = '15px';
        cancelBtn.onclick = () => {
            overlay.remove();
            resolve(null);
        };
        modal.appendChild(cancelBtn);

        overlay.appendChild(modal);
        document.body.appendChild(overlay);
    });
}

/**
 * Handles the logic of merging one section into another target.
 */
function handleMergeSections(sourceContainer, targetInfo) {
    const sourceContent = sourceContainer.querySelector('.print-section-content');
    if (!sourceContent) return;

    const sourceId = sourceContainer.dataset.originalId;
    const sourceAssociatedIds = sourceContainer.dataset.associatedIds ? JSON.parse(sourceContainer.dataset.associatedIds) : [];
    const allSourceIds = [sourceId, ...sourceAssociatedIds].filter(id => id);

    let targetContainer = null;
    let appendTarget = null;

    if (targetInfo.type === 'section') {
        targetContainer = targetInfo.element;
        appendTarget = targetContainer.querySelector('.print-section-content');
    } else {
        // Sheet target: append after the element
        appendTarget = targetInfo.element;
        // Search for the closest section container OR the sheet body wrapper
        targetContainer = appendTarget.closest('.print-section-container') || document.getElementById('print-layout-wrapper');
    }

    if (appendTarget) {
        // Create a wrapper that mimics the target's classes (to preserve styling)
        const wrapper = document.createElement('div');
        // Copy classes from target element, but exclude our identification/trigger classes
        const targetClasses = Array.from(targetInfo.element.classList)
                                   .filter(c => c !== 'be-extractable' && !c.startsWith('be-ext-'));
        wrapper.className = targetClasses.join(' ');
        
        wrapper.classList.add('be-merge-wrapper');
        // ADD BACK the essential extraction classes for the merged content itself
        wrapper.classList.add('be-extractable');
        const idClass = sourceContainer.dataset.beExtClass;
        if (idClass) wrapper.classList.add(idClass);
        
        // Tag for persistence if it's a group extraction
        const sourceId = sourceContainer.dataset.originalId;
        const isSpell = sourceContainer.classList.contains('be-spell-detail');
        if (!isSpell) {
            wrapper.setAttribute('data-be-group-merge', sourceId);
        }

        // Store target metadata for persistence
        wrapper.setAttribute('data-be-target-type', targetInfo.type);
        wrapper.setAttribute('data-be-target-id', targetInfo.id || '');
        if (targetInfo.type === 'sheet') {
            const res = getExtractionSelector(targetInfo.element, true); // True to include elements in containers
            if (res) {
                wrapper.setAttribute('data-be-target-selector', res.selector);
                wrapper.setAttribute('data-be-target-index', res.index);
                wrapper.setAttribute('data-be-target-name', targetInfo.name || '');
            }
        }

        // Attach extraction listener to the new merged wrapper
        wrapper.ondblclick = async (e) => {
            e.stopPropagation();
            await handleElementExtraction(wrapper);
        };

        // If source is a spell detail, tag it for persistence
        const spellName = isSpell ? (sourceContainer.querySelector('.print-section-header span')?.textContent.trim()) : null;
        let tagged = false;

        // Move all children of sourceContent to the wrapper
        while (sourceContent.firstChild) {
            const child = sourceContent.firstChild;
            
            if (child.nodeType === 1) { // Element
                // Clear dimensions that might have been set by resize logic
                child.style.width = '';
                child.style.minWidth = '';
                child.style.height = '';

                if (isSpell && !tagged) {
                    child.setAttribute('data-be-spell-merge', spellName);
                    child.setAttribute('data-be-original-id', sourceId);
                    tagged = true;
                }
            }
            wrapper.appendChild(child);
        }

        // Now append the wrapper to the final target
        if (targetInfo.type === 'section') {
            appendTarget.appendChild(wrapper);
        } else {
            // Insert after target element on sheet
            appendTarget.parentNode.insertBefore(wrapper, appendTarget.nextSibling);
        }

        // If target is a section, track IDs for rollback
        if (targetContainer) {
            const targetAssociatedIds = targetContainer.dataset.associatedIds ? JSON.parse(targetContainer.dataset.associatedIds) : [];
            const newAssociatedIds = [...targetAssociatedIds, ...allSourceIds];
            targetContainer.dataset.associatedIds = JSON.stringify(newAssociatedIds);
        }

        // Destroy source container
        sourceContainer.remove();
        updateLayoutBounds();
        showFeedback(`Merged into ${targetInfo.name}`);
    }
}

/**
 * Rolls back a section, restoring all associated original elements.
 */
function rollbackSection(container) {
    const originalId = container.dataset.originalId;
    const associatedIds = container.dataset.associatedIds ? JSON.parse(container.dataset.associatedIds) : [];
    
    const allIds = [originalId, ...associatedIds].filter(id => id);
    
    allIds.forEach(id => {
        const original = document.getElementById(id);
        if (original) {
            original.style.setProperty('display', '', 'important');
        }
    });

    container.remove();
    updateLayoutBounds();
    showFeedback('Extraction rolled back');
}

/**
 * Injects extracted clones into the live Spells view to create the print layout.
 */
async function injectClonesIntoSpellsView() {
  const containers = await extractAndWrapSections();

  // 1. Navigate to Spells to make it the active, visible view
  await navToSection('Spells');
  await new Promise(r => setTimeout(r, 200));

  // 2. Find the Live Spells Node (which is now visible)
  let spellsNode;
  const dom = window.DomManager.getInstance();
  const wrapper = dom.getSpellsContainer();
  spellsNode = wrapper ? wrapper.element : null;

  // Fallback to primary box if getSpellsContainer fails but we are on Spells tab?
  // If getSpellsContainer relies on a specific class that might be missing, we could try finding the visible primary box.
  if (!spellsNode) {
      // Use DomManager's generic PRIMARY_BOX selector
       const primaryBoxes = document.querySelectorAll(dom.selectors.UI.PRIMARY_BOX);
       spellsNode = Array.from(primaryBoxes).find(el => {
            const style = window.getComputedStyle(el);
            return style.display !== 'none' && !el.classList.contains('hidden');
       });
  }

  if (!spellsNode) {
      console.error('[DDB Print] Could not find Live Spells Node! Aborting injection.');
      return;
  }

  // 3. Clean up the Live Spells Node (Hide UI, Fix Layout)
  // We apply the same fixes as we did for clones, but IN PLACE.
  spellsNode.querySelectorAll('menu').forEach(el => el.style.display = 'none');

  
  spellsNode.style.cssText += 'height: fit-content !important; display: flex !important; flex-direction: column !important; max-height: none !important; overflow: visible !important;';
  
  spellsNode.querySelectorAll(dom.selectors.UI.PRIMARY_BOX + ', section').forEach(el => {
      el.style.cssText += 'height: fit-content !important; display: flex !important; flex-direction: column !important; max-height: none !important; overflow: visible !important;';
  });

  // Targeted SVG Removal for Spells: Use helper function
  removeSpecificSvgs(spellsNode);

  // We RESTORE the logic for other SVGs as per user request.

  const bgSvgs = spellsNode.querySelectorAll([
      dom.selectors.UI.PRIMARY_BOX + ' > ' + dom.selectors.SVG.ALL,
      dom.selectors.SVG.REP_BOX,
      dom.selectors.SVG.BOX_BACKGROUND + ':not([style*="display: none"]) ' + dom.selectors.SVG.ALL
  ].join(', '));
  bgSvgs.forEach(svg => {
      svg.style.height = '100%';
      svg.style.width = '100%';
      if(svg.hasAttribute('height')) svg.removeAttribute('height');
      if(svg.hasAttribute('width')) svg.removeAttribute('width');
      svg.setAttribute('preserveAspectRatio', 'none');
  });

  // Explicitly fix Group Boxes (Proficiency, Skills, Senses, Saving Throws) in Spells View

  const groupBoxSvgs = spellsNode.querySelectorAll([
        dom.selectors.SVG.PROFICIENCY,
        dom.selectors.SVG.SENSES,
        dom.selectors.SVG.SKILLS,
        dom.selectors.SVG.SAVING_THROWS
    ].join(', '));
  groupBoxSvgs.forEach(svg => {
       svg.setAttribute('preserveAspectRatio', 'none');
       svg.style.width = '100%';
       svg.style.height = '100%';
  });

  // 4. Identify the Unified Layout Root
  // We want to move everything to .ct-subsections
  const layoutRoot = document.querySelector(dom.selectors.CORE.SUBSECTIONS);
  if (!layoutRoot) {
      console.warn('[DDB Print] Could not find .ct-subsections! Falling back to original parent.');
      return;
  }
  layoutRoot.id = 'print-layout-wrapper';

  // 5. Wrap existing Children (Skills, Senses, etc.)
  // These are already in the DOM, we want to wrap them if they aren't already.
  let unnamedSectionCounter = 1;
  Array.from(layoutRoot.children).forEach(child => {
      if (!child.classList.contains('print-section-container')) {
          // Identify a title for the section (e.g. from a header)
          const titleEl = child.querySelector('header, ' + dom.selectors.CORE.SUBSECTION_HEADER);
          let title = titleEl ? titleEl.textContent.trim() : null;
          
          if (!title) {
              title = `Section ${unnamedSectionCounter++}`;
          }
          
          // Ensure SVGs are removed from existing sections too
          removeSpecificSvgs(child);
          
          // Wrap it
          const wrapped = createDraggableContainer(title, child, `section-${title.replace(/\s+/g, '-')}`);
          layoutRoot.appendChild(wrapped); // This moves 'child' into 'wrapped'
      }
  });

  // 6. Wrap and Inject the Live Spells Node
  const spellsContainer = createDraggableContainer('Spells', spellsNode, 'section-Spells');

  // 7. Consolidate All Clones
  const allSectionsOrdered = [];
  const actionsContainer = containers.find(c => c.textContent.includes('Actions'));
  if (actionsContainer) allSectionsOrdered.push(actionsContainer);
  
  allSectionsOrdered.push(spellsContainer);
  
  containers.forEach(container => {
      if (!allSectionsOrdered.includes(container)) {
          allSectionsOrdered.push(container);
      }
  });

  // Inject everything into the layout root
  allSectionsOrdered.forEach(container => {
      layoutRoot.appendChild(container); // Append moves them to the end or maintains order if prepended
  });

  // 8. Hide Navigation UI (Using DomManager)
  window.DomManager.getInstance().getNavigation().hide();

  
  // 9. Inject spell detail triggers into all sections
  injectSpellDetailTriggers(layoutRoot);
  
  // Clean up global definitions
  copySvgDefinitions(document.body); 
}

/**
 * Relocates defense information.
 */
function moveDefenses() {
  const dom = window.DomManager.getInstance();
  const defensesSection = document.querySelector(dom.selectors.CORE.DEFENSES) || 
                          document.querySelector(dom.selectors.CORE.DEFENSES_ALT);
  if (!defensesSection) return;

  const elem = defensesSection.cloneNode(true);
  removeSpecificSvgs(elem); // Ensure SVGs are removed from Defenses clone
  
  // Remove header
  const header = elem.querySelector(dom.selectors.CORE.DEFENSES_HEADER) || 
                 elem.querySelector(dom.selectors.CORE.DEFENSES_HEADER_ALT);
  if (header) header.remove();

  const combatTablet = document.querySelector(dom.selectors.CORE.COMBAT_TABLET) || 
                       document.querySelector(dom.selectors.CORE.COMBAT_TABLET_ALT);
                       
  if (combatTablet) {
    const container = document.createElement('div');
    container.style['border'] = 'thin black solid';
    container.style['margin-top'] = '10px';
    container.appendChild(elem);
    combatTablet.parentElement.appendChild(container);
  }
}

/**
 * Optimized layout for print.
 */
function tweakStyles() {
  // Hide major UI components using DomManager
  window.DomManager.getInstance().hideCoreInterface();

  const dom = window.DomManager.getInstance();
  const name = document.querySelector(dom.selectors.CORE.TIDBITS_NAME) || 
               document.querySelector(dom.selectors.CORE.TIDBITS_NAME_ALT);
  if (name) name.style['color'] = 'black';

  // HP recovery
  const allElements = Array.from(document.querySelectorAll('*'));
  const hpElements = allElements.filter(el => 
    el.textContent.trim().match(/^\d+\s*\/\s*\d+$/) && el.children.length === 0
  );
  
  hpElements.forEach(el => {
    el.style['font-size'] = '30px';
    el.style['font-weight'] = 'bold';
    el.style['color'] = 'black';
  });
}

/**
 * Moves the character portrait to the primary box.
 */
function movePortrait() {
    // User Request: Append .ddbc-character-avatar__portrait to .ct-subsection.ct-subsection--primary-box
    const dom = window.DomManager.getInstance();
    const portrait = document.querySelector(dom.selectors.UI.PORTRAIT);
    // UI.PRIMARY_BOX might be .ct-primary-box, check if we have the specific subsection target
    // The previous code targeted .ct-subsection.ct-subsection--primary-box
    const target = document.querySelector('.ct-subsection.ct-subsection--primary-box');
    
    if (portrait && target) {
        // Ensure portrait is visible and styled properly
        portrait.style.display = 'block';
        portrait.style.width = '100%';
        portrait.style.height = 'auto'; // Maintain aspect ratio
        
        target.appendChild(portrait);
        console.log('[DDB Print] Moved character portrait.');
    } else {
        console.warn('[DDB Print] Could not find portrait or target to move.');
    }
}

/**
 * Moves Quick Info to a draggable container.
 */
function moveQuickInfo() {
    // User Request: Make .ct-quick-info draggable
    let quickInfo;
    const dom = window.DomManager.getInstance();
    const wrapper = dom.getQuickInfo();
    quickInfo = wrapper ? wrapper.element : null;

    if (quickInfo) {
        const layoutRoot = document.getElementById('print-layout-wrapper');
        if (layoutRoot) {
             // Clone it? Or move it? Moving is safer for events, but cloning preserves original structure if needed.
             // Let's move it to preserve functionality.
             const container = createDraggableContainer('Quick Info', quickInfo, 'section-Quick-Info');
             layoutRoot.appendChild(container);
             
             // Ensure it's visible if parent was hidden
             quickInfo.style.display = 'flex'; 
             // quickInfo usually has fixed position/margin in normal sheet, reset it
             quickInfo.style.position = 'static';
             quickInfo.style.margin = '0';
        }
    }
}

/**
 * Suppresses global resize events to stabilize custom layout.
 */
function suppressResizeEvents() {
    console.log('[DDB Print] Suppressing global resize events...');
    
    // 1. Nullify window.onresize
    window.onresize = null;

    // 2. Stop propagation of resize events in the capture phase
    // This targets listeners added BEFORE the extension was loaded
    window.addEventListener('resize', (e) => {
        e.stopImmediatePropagation();
    }, true);

    // 3. Intercept addEventListener for 'resize'
    const originalAddEventListener = window.addEventListener;
    window.addEventListener = function(type, listener, options) {
        if (type === 'resize') {
            console.log('[DDB Print] Blocking external resize listener.');
            return;
        }
        return originalAddEventListener.apply(this, arguments);
    };
}

/**
 * Separates ability scores into individual draggable sections.
 * This function:
 * 1. Identifies all ability score elements using DomManager selectors.
 * 2. Wraps each ability in a new draggable 'print-section-container'.
 * 3. Applies the 'ability_border' style by default.
 * 4. Moves the elements to the print layout wrapper.
 * 5. Performs specific SVG removal for each new container.
 * 6. Destroys the original empty parent sections to clean up the UI.
 */
function separateAbilities() {
    const dom = window.DomManager.getInstance();
    const abilities = document.querySelectorAll(dom.selectors.CORE.ABILITY);
    const layoutRoot = document.getElementById('print-layout-wrapper');

    if (!abilities.length || !layoutRoot) return;

    console.log(`[DDB Print] Separating ${abilities.length} abilities...`);

    const parentsToRemove = new Set();

    abilities.forEach((ability, index) => {
        const parentSection = ability.closest('section');
        if (parentSection) parentsToRemove.add(parentSection);

        const nameEl = ability.querySelector(dom.selectors.CORE.ABILITY_NAME);
        const name = nameEl ? nameEl.textContent.trim() : `Ability ${index + 1}`;
        const id = `section-Ability-${name}`;

        // Create container and MOVE the element
        const container = createDraggableContainer(name, ability, id);
        
        // Default to ability border (if not overridden by saved layout later)
        container.classList.add('ability_border');
        
        layoutRoot.appendChild(container);

        // Targeted SVG Removal for the new section
        removeSpecificSvgs(container);

        // Reset internal styles to fit new container
        ability.style.margin = '0';
        ability.style.width = '100%';
        ability.style.display = 'flex';
        ability.style.flexDirection = 'column';
        ability.style.alignItems = 'center';
    });

    // Destroy empty parents
    parentsToRemove.forEach(p => p.remove());
}

/**
 * Separates individual Quick Info boxes (AC, Initiative, etc.) into draggable sections.
 */
function separateQuickInfoBoxes() {
    const dom = window.DomManager.getInstance();
    const boxes = document.querySelectorAll(dom.selectors.CORE.QUICK_INFO_BOX);
    const layoutRoot = document.getElementById('print-layout-wrapper');

    if (!boxes.length || !layoutRoot) return;

    console.log(`[DDB Print] Separating ${boxes.length} quick-info boxes...`);

    const parentsToRemove = new Set();

    boxes.forEach((box, index) => {
        // Collect parent for cleanup (usually .ct-quick-info)
        const parentGroup = box.closest(dom.selectors.CORE.QUICK_INFO);
        if (parentGroup) parentsToRemove.add(parentGroup);

        const labelEl = box.querySelector(dom.selectors.CORE.QUICK_INFO_BOX_LABEL);
        const label = labelEl ? labelEl.textContent.trim() : `Box ${index + 1}`;
        const id = `section-Box-${label.replace(/\s+/g, '-')}`;

        // Create container and MOVE the element
        const container = createDraggableContainer(label, box, id);
        
        // Default to box border
        container.classList.add('box_border');
        
        layoutRoot.appendChild(container);

        // Targeted SVG Removal for the new section
        removeSpecificSvgs(container);

        // Reset internal styles
        box.style.margin = '0';
        box.style.width = '100%';
        box.style.display = 'flex';
        box.style.flexDirection = 'column';
        box.style.alignItems = 'center';
    });

    // Extract Health if present (User Request)
    const health = document.querySelector(dom.selectors.UI.QUICK_INFO_HEALTH);
    if (health) {
        // Only extract if it hasn't been extracted yet
        if (!document.getElementById('section-Quick-Info-Health')) {
            const container = createDraggableContainer('Health', health, 'section-Quick-Info-Health');
            // Remove the header inside health if it exists to avoid duplication/weirdness
            const healthHeader = health.querySelector('h1');
            // We can't easily remove h1 if it's needed, but let's trust CSS to handle display
            
            layoutRoot.appendChild(container);
            
            // Fix health display
            health.style.display = 'block';
            health.style.position = 'static';
            health.style.width = '100%';
            
            removeSpecificSvgs(container);
            
            // Mark parent for removal if health was inside it
            const parentGroup = health.parentElement; // usually .ct-quick-info
             if (parentGroup && parentGroup.matches(dom.selectors.CORE.QUICK_INFO)) {
                 parentsToRemove.add(parentGroup);
             }
        }
    }

    // Destroy empty groups
    parentsToRemove.forEach(p => p.remove());
}

/**
 * Drag and Drop Engine
 */
let draggedItem = null;
let offsetX = 0;
let offsetY = 0;

function initDragAndDrop() {
  const container = document.getElementById('print-layout-wrapper');
  if (!container) return;

  container.addEventListener('dragstart', e => {
    draggedItem = e.target.closest('.print-section-container');
    if (draggedItem) {
        e.dataTransfer.effectAllowed = 'move';
        
        const rect = draggedItem.getBoundingClientRect();
        offsetX = e.clientX - rect.left;
        offsetY = e.clientY - rect.top;
        
        // User Request: Show full content while dragging
        // We set the drag image explicitly to the container.
        if (e.dataTransfer.setDragImage) {
             e.dataTransfer.setDragImage(draggedItem, offsetX, offsetY);
        }

        // Delay opacity change so the browser captures the full opacity element as the image
        requestAnimationFrame(() => {
            draggedItem.style.opacity = '0.98';
        });

    }
  });

  container.addEventListener('dragover', e => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    return false;
  });

    container.addEventListener('drop', e => {
      e.preventDefault();
      e.stopPropagation();
      
      if (draggedItem) {
          const containerRect = container.getBoundingClientRect();
          
          // Calculate relative position to container
          let x = e.clientX - containerRect.left - offsetX;
          let y = e.clientY - containerRect.top - offsetY;

          // Snap to 16px grid
          x = Math.round(x / 16) * 16;
          y = Math.round(y / 16) * 16;
          
          draggedItem.style.left = `${x}px`;
          draggedItem.style.top = `${y}px`;
          draggedItem.style.margin = '0'; // Ensure no margin interference
      }
      return false;
    });

  container.addEventListener('dragend', () => {
    if (draggedItem) draggedItem.style.opacity = '1';
    draggedItem = null;
    updateLayoutBounds();
  });
}

/**
 * UI Refinement logic to remove unnecessary print elements.
 */
function removeSearchBoxes() {
  const dom = window.DomManager.getInstance();
  const s = dom.selectors;
  const searchSelectors = [
    s.UI.HEADER_WRAPPER,
    s.UI.SEARCH_INPUT,
    s.UI.FILTER_GENERIC,
     // Add DomManager selectors
     s.SPELLS.FILTER,
     s.EQUIPMENT.FILTER,
     s.EQUIPMENT.INVENTORY_FILTER,
     s.EXTRAS.FILTER,
     s.TRAITS.MANAGEMENT_LINK
  ].filter(Boolean); // Filter out undefineds

  // Flatten and query
  const allSelectors = searchSelectors.join(',');
  document.querySelectorAll(allSelectors).forEach(el => {
    // User Request: Preserve Filters on Live Spells Tab
    // Check if element is inside Spells container (or is the spells filter itself checking ancestors)
    if (el.closest('.ct-spells') || el.closest('[data-testid="SPELLS"]')) {
        return;
    }
    el.remove();
  });
}

function enforceFullHeight() {
    const styleId = 'ddb-print-enhance-style';
    if (document.getElementById(styleId)) return;

    const dom = window.DomManager.getInstance();
    let s = dom.selectors;


    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
        :root {
            --border-img: url('${chrome.runtime.getURL('assets/border_default.png')}');
            --border-img-width: 28px;
            --border-img-outset: 16px;
            --border-img-slice: 33;
            --btn-color: #c53131;
            --btn-color-highlight: #f18383ff;
        }
        .no-border {
            border-image-source: none !important;
            border-style: none !important;
        }
        .default-border {
            --border-img: url('${chrome.runtime.getURL('assets/border_default.png')}');
            --border-img-width: 28px;
            --border-img-outset: 16px;
            --border-img-slice: 33;
        }
        .ability_border {
            --border-img: url('${chrome.runtime.getURL('assets/border_ability.gif')}');
            --border-img-width: 28px;
            --border-img-slice: 25;
            --border-img-outset: 8px;
        }
        .spikes_border {
            --border-img: url('${chrome.runtime.getURL('assets/border_spikes.gif')}');
            --border-img-width: 118px;
            --border-img-slice: 177;
            --border-img-outset: 55px;
        }
        .barbarian_border {
            --border-img: url('${chrome.runtime.getURL('assets/border_barbarian.gif')}');
            --border-img-width: 208px;
            --border-img-slice: 311;
            --border-img-outset: 61px;
        }
        .goth_border {
            --border-img: url('${chrome.runtime.getURL('assets/border_goth1.gif')}');
            --border-img-width: 111px;
            --border-img-slice: 166;
            --border-img-outset: 50px 35px;
        }
        .plants_border {
            --border-img: url('${chrome.runtime.getURL('assets/border_plants.gif')}');
            --border-img-width: 145px;
            --border-img-slice: 219;
            --border-img-outset: 50px;
        }
        .box_border {
            --border-img: url('${chrome.runtime.getURL('assets/border_box.gif')}');
            --border-img-width: 25px;
            --border-img-slice: 22;
            --border-img-outset: 7px 10px;
        }
        .dwarf_border {
            --border-img: url('${chrome.runtime.getURL('assets/dwarf.gif')}');
            --border-img-width: 205px;
            --border-img-slice: 400;
            --border-img-outset: 173px;
        }
        .dwarf_hollow_border {
            --border-img: url('${chrome.runtime.getURL('assets/dwarf_hollow.gif')}');
            --border-img-width: 205px;
            --border-img-slice: 400;
            --border-img-outset: 173px;
        }
        .sticks_border {
            --border-img: url('${chrome.runtime.getURL('assets/sticks.gif')}');
            --border-img-width: 90px;
            --border-img-slice: 383;
            --border-img-outset: 22px;
        }
        .ornament_border {
            --border-img: url('${chrome.runtime.getURL('assets/ornament.gif')}');
            --border-img-width: 60px;
            --border-img-slice: 255;
            --border-img-outset: 25px;
        }
        .ornament2_border {
            --border-img: url('${chrome.runtime.getURL('assets/ornament2.gif')}');
            --border-img-width: 60px;
            --border-img-slice: 255;
            --border-img-outset: 25px;
        }
        .ornament_bold_border {
            --border-img: url('${chrome.runtime.getURL('assets/ornament_bold.gif')}');
            --border-img-width: 80px;
            --border-img-slice: 335;
            --border-img-outset: 25px;
        }
        .ornament_bold2_border {
            --border-img: url('${chrome.runtime.getURL('assets/ornament_bold2.gif')}');
            --border-img-width: 80px;
            --border-img-slice: 333;
            --border-img-outset: 24px;
        }
        .ornament_simple_border {
            --border-img: url('${chrome.runtime.getURL('assets/ornament_simple.gif')}');
            --border-img-width: 50px;
            --border-img-slice: 255;
            --border-img-outset: 20px;
        }
        .spike_hollow_border {
            --border-img: url('${chrome.runtime.getURL('assets/spike_hollow.gif')}');
            --border-img-width: 100px;
            --border-img-slice: 388;
            --border-img-outset: 50px;
        }
        .spiky_border {
            --border-img: url('${chrome.runtime.getURL('assets/spiky.gif')}');
            --border-img-width: 100px;
            --border-img-slice: 388;
            --border-img-outset: 60px;
        }
        .spiky_bold_border {
            --border-img: url('${chrome.runtime.getURL('assets/spiky_bold.gif')}');
            --border-img-width: 120px;
            --border-img-slice: 388;
            --border-img-outset: 69px;
        }
        .vine_border {
            --border-img: url('${chrome.runtime.getURL('assets/vine_holloow.gif')}');
            --border-img-width: 130px;
            --border-img-slice: 429;
            --border-img-outset: 45px;
        }

        @media print {
            @page {
                margin: 0;
                size: letter portrait;
            }
            body {
                /* User Request: Manual margins assuming 0 hardware margin */
                margin-top: 0in !important;
                margin-bottom: 0.25in !important;
                margin-left: 0.1in !important;
                margin-right: 0.1in !important;
                padding: 0 !important;
            }
            
            html {
                margin: 0 !important;
                padding: 0 !important;
            }
        }
        .print-section-content {
            overflow: visible !important;
            max-height: none !important;
            padding: 0;
            height: auto !important;
        }
        .ct-quick-info__box,
        section {
            height: 100% !important;
            padding: 0 !important;
        }

        ${s.UI.TOOLS_TARGET} {
            background-color: white;
        }

        /* Deep Clean: Aggressively hide top elements */
        [data-original-id="section-Section-6"] .print-section-header > span, 
        [data-original-id="section-Section-6"] .print-section-content ${s.UI.PRIMARY_BOX}, 
        div#section-Section-6 .print-section-header > span, 
        div#section-Section-6 .print-section-content ${s.UI.PRIMARY_BOX}, 
        ${s.CORE.FOOTER}, 
        ${s.CORE.HEADER_MAIN}, 
        ${s.CORE.MEGA_MENU_TARGET}, 
        ${s.CORE.MM_NAVBAR},
        ${s.CORE.NAVIGATION}, 
        ${s.CORE.NOTIFICATIONS},
        ${s.CORE.SITE_ALERT}, 
        ${s.CORE.SITE_BAR}, 
        ${s.CORE.WATERMARK}, 
        ${s.CSS.DIALOG_SIBLING},
        ${s.CSS.SHEET_BEFORE},
        ${s.EQUIPMENT.FILTER},
        ${s.EXTRAS.INTERACTIONS},
        ${s.SPELLS.ACTION},
        ${s.UI.COLLAPSED_ACTIONS},
        ${s.UI.DICE_ROLLER},
        ${s.UI.FEATURES_LINK},
        ${s.UI.HEADER_DESKTOP},
        ${s.UI.QUICK_INFO_HEALTH_HEADER},
        ${s.UI.QUICK_INFO_INSPIRATION},
        ${s.UI.SUBSECTION_FOOTER},
        ${s.UI.THEME_LINK},
        ${s.UI.TIDBITS_HEADING} {
            display: none !important;
        }

        ${s.UI.QUICK_INFO_HEALTH} h1 {
            position: static;
            transform: none;
        }
        /* REsizable */
        ${s.CORE.SHEET_DESKTOP} ${s.UI.SUBSECTION} {
            position: static!important;
            display: flex!important;
            flex-flow: row!important;
            height: 100%;
        }
        ${s.CORE.SHEET_DESKTOP} ${s.CORE.SUBSECTIONS} {
            height: auto !important;
            display: block;
            width: 100%;
            position: relative !important;
        }

        /* User Request: Side Panel Fixed & Scrollable */
        ${s.CORE.SIDEBAR_PORTAL} {
            position: fixed !important;
            top: 0 !important;
            right: 0 !important;
            height: 100% !important;
            z-index: 9999 !important;
        }
        ${s.CORE.SPELL_MANAGER} {
            overflow-y: auto !important;
            max-height: 100% !important;
        }
        ${s.CORE.SIDEBAR} {
            position: static !important;
        }
        ${s.UI.SIDEBAR_INNER} {
            overflow-y: auto !important;
            overflow-x: hidden !important;
        }
        ${s.UI.CHARACTER_SHEET} {
            background: url(https://www.dndbeyond.com/avatars/61/510/636453152253102859.jpeg) no-repeat, url(https://www.dndbeyond.com/attachments/0/84/background_texture.png) #333 !important;
        }
        ${s.CORE.SHEET_DESKTOP} {
            background-color: white;
            height: 100%;
            -webkit-box-shadow: 5px 5px 15px 5px #3f3f3fff;
            box-shadow: 5px 5px 15px 5px #3f3f3fff;
        }

        .print-section-wrapper,
        .print-section-wrapper > * {
            width: 100%;
            max-width: 1200px;
            padding: 0 !important;
        }

        @media (min-width: 1200px) {
            ${s.UI.PRIMARY_BOX} {
                width: 100% !important;
            }
        }

        @media screen {
            ${s.CORE.SHEET_DESKTOP} {
                max-width: none !important;
                margin: 0 !important;
                width: 100% !important;
                background-color: white !important;
            }
        }
        
        ${s.UI.PRINT_CONTAINER} { 
            --reduce-height-by: 0px;
            --reduce-width-by: 0px;
            background-color: rgba(255, 255, 255, 0.85);
            border-color: transparent;
            border-image-outset: var(--border-img-outset);
            border-image-repeat: round;
            border-image-slice: var(--border-img-slice);
            border-image-source: var(--border-img);
            border-image-width: var(--border-img-width);
            border-style: solid;
            border-width: 0;
            box-decoration-break: clone;
            -webkit-box-decoration-break: clone;
            box-sizing: border-box;
            break-inside: avoid; 
            display: flex !important;
            flex-direction: column !important;
            min-height: 30px !important;
            min-width: 50px !important;
            overflow: hidden !important; /* Changed from auto to hidden, we'll handle scroll/scale */
            position: absolute !important;
            z-index: 10;        
        }
        ${s.UI.PRINT_CONTAINER}:hover { 
            box-shadow: 2px 2px 5px rgba(0,0,0,0.1);
        }

        .print-shape-container {
            background-color: transparent !important;
            border-width: 0;
            border-style: solid;
            pointer-events: auto;
        }
        .print-shape-container .print-section-content {
            background-color: transparent !important;
        }
        .print-shape-container .print-section-header {
            opacity: 0;
            background-color: rgba(197, 49, 49, 0.5) !important;
        }
        .print-shape-container:hover .print-section-header {
            opacity: 1;
        }

        ${s.UI.PRINT_CONTAINER}, 
        ${s.UI.PRINT_CONTAINER} * {
            font-size: 8px !important;
            white-space: normal !important;
            overflow-wrap: break-word !important;
        }
        ${s.UI.PRINT_CONTAINER} ${s.COMBAT.STATUSES} h2 *,
        ${s.UI.PRINT_CONTAINER} ${s.COMBAT.STATUSES} h2 + *,
        ${s.UI.PRINT_CONTAINER} ${s.CORE.QUICK_INFO} * {
            font-size: 12px !important;
        }
        ${s.UI.PRINT_CONTAINER} ${s.UI.QUICK_INFO_HEALTH} * {
            font-size: 14px !important;
        }
        ${s.UI.PRINT_CONTAINER} ${s.CORE.HEADING_STYLES},
        ${s.UI.PRINT_CONTAINER} ${s.CORE.SECTION_HEADING_STYLES},
        ${s.UI.PRINT_CONTAINER} ${s.CORE.HEADING_SUFFIX},
        ${s.UI.PRINT_CONTAINER} ${s.CORE.HEADING_SUFFIX_ALT},
        ${s.UI.PRINT_CONTAINER} ${s.CORE.HEADING_SUFFIX_ALT} ,
        ${s.UI.PRINT_CONTAINER} ${s.CORE.GROUP_HEADER_CONTENT} {
            font-size: 12px !important;
            font-weight: bold !important;
            text-transform: uppercase;
            border-bottom: 1px solid #979797;
            margin-bottom: 4px;
        }
        ${s.UI.PRINT_CONTAINER} ${s.CORE.SECTION_HEADING_STYLES},
        ${s.UI.PRINT_CONTAINER} ${s.CORE.HEADING_SUFFIX_ALT},
        ${s.UI.PRINT_CONTAINER} ${s.CORE.HEADING_SUFFIX_ALT}  {
            font-size: 10px !important;
        }
        ${s.UI.PRINT_CONTAINER} ${s.CORE.SECTION_HEADING_STYLES},
        ${s.UI.PRINT_CONTAINER} ${s.CORE.HEADING_SUFFIX_ALT},
        ${s.UI.PRINT_CONTAINER} ${s.CORE.HEADING_SUFFIX_ALT} ,
        ${s.UI.PRINT_CONTAINER} ${s.CORE.HEADING_STYLES} ${s.CORE.HEADING_SUFFIX} {
            border-bottom: 0
        }
        @media print {
            body, ${s.CORE.SHEET_DESKTOP} {
                margin: 0 !important;
                padding: 0 !important;
                box-shadow: none !important;
                transform: none !important;
            }
            ${s.SPELLS.FILTER} {
                visibility: hidden;
            }
            .print-page-separator {
                display: none !important;
            }
        }
        .print-section-content {
            flex: 1 1 auto !important;
            overflow: hidden !important;
            display: flex !important;
            flex-direction: column !important;
            position: relative !important;
        }
        ${s.SENSES.CALLOUT_VALUE},
        ${s.CORE.DICE_CONTAINER},
        ${s.CORE.DICE_CONTAINER} span {
            font-size: 16px !important;
        }
        ${s.COMBAT.AC_VALUE} {
            font-size: 26px !important;
        }

            /* Scaling helper */
        ${s.UI.PRINT_CONTAINER}[data-scaling="true"] .print-section-content > div {
            transform-origin: top left;
        }
        ${s.UI.PRINT_CONTAINER} ${s.COMPACT.ROW_HEADER_DIV}, 
        ${s.UI.PRINT_CONTAINER} ${s.COMPACT.GENERIC_CONTENT_DIV_DIV} {
            min-width: 38px;
        }
        ${s.UI.PRINT_CONTAINER} ${s.COMPACT.ROW_HEADER_NAME}, 
        ${s.UI.PRINT_CONTAINER} ${s.COMPACT.CONTENT_NAME} {
            max-width: 72px;
        }
        ${s.UI.PRINT_CONTAINER} ${s.COMPACT.CONTENT_SLOT_NAME} {
            max-width: 200px;
        }
        ${s.UI.PRINT_CONTAINER} ${s.COMPACT.CONTENT_ITEM_NAME} {
            max-width: 136px;
        }
    
        ${s.UI.PORTRAIT} {
            width: 100%;
        }
        
        .print-section-header span {
            font-size: 16px !important;
        }
        .print-section-header {
            cursor: move;
            user-select: none;
            font-size: 18px !important;
            opacity: 0;
            position: absolute;
            transition: opacity 0.2s;
            margin-top: 0px;
            z-index: 999999999;
            width: calc(100% - 64px);
            height: 32px;
            background-color: var(--btn-color);
            line-height: 18px;
            left: 32px;
            border-radius: 32px;
            padding: 0 16px;
            filter: drop-shadow(2px 4px 6px black);
            min-width: max-content;
        }
        ${s.UI.PRINT_CONTAINER}:hover .print-section-header {
            opacity: 1;
        }

        /* Ability Summary */

        ${s.ABILITY.SUMMARY} {
            display: contents;
        }
        ${s.ABILITY.SUMMARY_SECONDARY} {
            position: static!important;
            border: 2px solid var(--btn-color);
            border-radius: 150px;
            padding: 8px 13px;
            font-size: 16px !important;
            width: fit-content;
            background: white;
        }
        ${s.ABILITY.SUMMARY_LABEL} {
            font-size: 12px !important;
        }

        /* PROFICIENCY & WALKING SPEED */
        
        .ct-quick-info__box * {
            font-size: 14px !important;
            line-height: 21px;
        }

        /* Custom Resize Handle */

        .print-section-resize-handle {
            position: absolute;
            bottom: 0;
            right: 0;
            width: 16px;
            height: 16px;
            cursor: se-resize;
            z-index: 20;
            opacity: 0; /* Hidden by default */
        }
        ${s.UI.PRINT_CONTAINER}:hover .print-section-resize-handle {
            opacity: 1;
            background: linear-gradient(135deg, transparent 50%, var(--btn-color) 50%);
        }

        /* Skills specific compact logic (already mostly covered by global above) */
        ${s.SKILLS.CONTAINER}, ${s.SKILLS.CONTAINER} * {
            font-size: 8px !important;
        }

        ${s.SKILLS.BOX} {
            overflow: hidden !important;
            border: 1px solid black !important;
        }

        .print-section-container.minimized .print-section-header,
        .print-section-container.minimized .print-section-content {
            display: none !important;
        }

        .print-section-container.minimized .print-section-restore {
            display: block !important;
        }

        /* Unified Section Action Buttons */
        .be-section-actions {
            position: absolute;
            top: 46px;
            left: 32px;
            display: flex;
            gap: 8px;
            z-index: 20;
            opacity: 0;
            transition: opacity 0.2s;
            pointer-events: none;
        }
        ${s.UI.SUBSECTION}:hover .be-section-actions,
        ${s.UI.SECTION}:hover .be-section-actions,
        .print-section-container:hover .be-section-actions {
            opacity: 1;
            pointer-events: auto;
        }
        .be-section-actions button {
            width: 39px;
            height: 32px;
            cursor: pointer;
            background: var(--btn-color);
            border: 1px solid rgb(85, 85, 85);
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 0;
            margin: 0;
            filter: drop-shadow(2px 4px 6px black);
            border-radius: 32px;
            color: white;
            font-size: 18px !important;
            transition: background-color 0.2s;
        }
        .be-section-actions button:hover {
            background-color: var(--btn-color-highlight);
        }
        .be-clone-button {
            font-size: 21px !important;
        }
        .be-clone-delete:hover {
            background: #cc0000 !important;
        }
        @media print {
            .be-section-actions {
                display: none !important;
            }
        }

        /* Modal Styles */
        .be-modal-overlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.7);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 100000;
            backdrop-filter: blur(4px);
        }
        .be-modal {
            background: #222;
            color: white;
            padding: 24px;
            border-radius: 12px;
            width: 400px;
            max-width: 90%;
            box-shadow: 0 10px 30px rgba(0,0,0,0.5);
            border: 1px solid #444;
            display: flex;
            flex-direction: column;
            gap: 16px;
        }
        .be-modal h3 {
            margin: 0;
            font-size: 18px;
        }
        .be-modal p {
            margin: 0;
            font-size: 14px;
            color: #ccc;
        }
        .be-modal input {
            background: #111;
            border: 1px solid #444;
            color: white;
            padding: 8px 12px;
            border-radius: 4px;
            font-size: 14px;
        }
        .be-modal-actions {
            display: flex;
            justify-content: flex-end;
            gap: 12px;
        }
        .be-modal-actions button {
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
            border: 1px solid #555;
        }
        .be-modal-ok {
            background: #444;
            color: white;
        }
        .be-modal-cancel {
            background: transparent;
            color: #ccc;
        }

        /* Border Picker Styles */
        .be-border-options {
            display: flex;
            flex-wrap: wrap;
            gap: 15px;
            overflow-y: auto;
            max-height: 400px;
            margin: 20px 0;
            justify-content: center;
        }
        .be-border-option {
            cursor: pointer;
            padding: 10px;
            border: 2px solid transparent;
            transition: all 0.2s;
            text-align: center;
            width: 100px;
            border-radius: 4px;
        }
        .be-border-option:hover {
            background: #333;
        }
        .be-border-option.selected {
            border-color: var(--btn-color);
            background: #444;
        }
        .be-border-preview {
            width: 80px;
            height: 80px;
            margin: 0 auto 5px;
            background: white;
            box-sizing: border-box;
            border-width: 0px;
            border-style: solid;
            border-color: transparent;
            border-image-source: var(--border-img);
            border-image-slice: var(--border-img-slice);
            border-image-width: var(--border-img-width);
            border-image-repeat: round;
        }
    `;
    document.head.appendChild(style);
}

/**
 * Shows a modal to manage existing clones.
 */
function handleManageClones() {
    const clones = document.querySelectorAll('.print-section-container.be-clone');
    if (clones.length === 0) {
        showFeedback('No clones found');
        return;
    }

    // Modal for managing clones
    const overlay = document.createElement('div');
    overlay.className = 'be-modal-overlay';
    
    const modal = document.createElement('div');
    modal.className = 'be-modal';
    modal.style.width = '500px';
    
    const h3 = document.createElement('h3');
    h3.textContent = 'Manage Clones';
    modal.appendChild(h3);
    
    const list = document.createElement('div');
    list.style.maxHeight = '300px';
    list.style.overflowY = 'auto';
    list.style.display = 'flex';
    list.style.flexDirection = 'column';
    list.style.gap = '8px';
    
    clones.forEach(clone => {
        const item = document.createElement('div');
        item.style.display = 'flex';
        item.style.justifyContent = 'space-between';
        item.style.alignItems = 'center';
        item.style.padding = '8px';
        item.style.background = '#333';
        item.style.borderRadius = '4px';
        
        const titleSpan = clone.querySelector('.print-section-header span');
        const name = titleSpan ? titleSpan.textContent : 'Unnamed Clone';
        
        const nameLabel = document.createElement('span');
        nameLabel.textContent = name;
        item.appendChild(nameLabel);
        
        const actions = document.createElement('div');
        actions.style.display = 'flex';
        actions.style.gap = '8px';
        
        const goBtn = document.createElement('button');
        goBtn.textContent = '🎯';
        goBtn.title = 'Jump to Clone';
        goBtn.onclick = () => {
            clone.scrollIntoView({ behavior: 'smooth', block: 'center' });
            // Flash effect
            const originalOutline = clone.style.outline;
            clone.style.outline = '4px solid gold';
            setTimeout(() => clone.style.outline = originalOutline, 1000);
            overlay.remove();
        };
        actions.appendChild(goBtn);
        
        const delBtn = document.createElement('button');
        delBtn.textContent = '🗑️';
        delBtn.title = 'Delete Clone';
        delBtn.onclick = () => {
            if (confirm(`Delete "${name}"?`)) {
                clone.remove();
                item.remove();
                if (list.children.length === 0) {
                    overlay.remove();
                }
                showFeedback('Clone deleted');
                updateLayoutBounds();
            }
        };
        actions.appendChild(delBtn);
        
        item.appendChild(actions);
        list.appendChild(item);
    });
    
    modal.appendChild(list);
    
    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'Close';
    closeBtn.className = 'be-modal-ok';
    closeBtn.onclick = () => overlay.remove();
    modal.appendChild(closeBtn);
    
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
}

/**
 * Captures a static snapshot of a section's content.
 * @param {string} sectionId 
 * @returns {object} Snapshot data.
 */
function captureSectionSnapshot(sectionId) {
    const section = document.getElementById(sectionId);
    if (!section) return null;

    const content = section.querySelector('.print-section-content');
    if (!content) return null;

    // Use centralized sanitization
    const sanitizedClone = getSanitizedContent(content);

    const getBorderStyle = (el) => {
        if (el.classList.contains('no-border')) return 'no-border';
        if (el.classList.contains('ability_border')) return 'ability_border';
        if (el.classList.contains('spikes_border')) return 'spikes_border';
        if (el.classList.contains('barbarian_border')) return 'barbarian_border';
        if (el.classList.contains('goth_border')) return 'goth_border';
        if (el.classList.contains('plants_border')) return 'plants_border';
        if (el.classList.contains('box_border')) return 'box_border';
        if (el.classList.contains('default-border')) return 'default-border';
        return null;
    };

    return {
        originalId: sectionId,
        html: sanitizedClone.innerHTML,
        borderStyle: getBorderStyle(section),
        styles: {
            width: section.style.width,
            height: section.style.height
        }
    };
}

/**
 * Renders a cloned section from snapshot data.
 * @param {object} snapshot 
 * @returns {HTMLElement} The created container.
 */
function renderClonedSection(snapshot) {
    const fragment = document.createDocumentFragment();
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = snapshot.html;
    
    // Sanitize loaded HTML to prevent duplication
    const sanitizedClone = getSanitizedContent(tempDiv);
    
    // Create the static header requested by user
    const dom = window.DomManager.getInstance();
    const staticHeader = document.createElement('div');
    staticHeader.className = dom.selectors.EXTRACTABLE.CONTENT_GROUP_HEADER.substring(1);
    const staticHeaderContent = document.createElement('div');
    staticHeaderContent.className = dom.selectors.CORE.GROUP_HEADER_CONTENT.substring(1);
    staticHeaderContent.textContent = snapshot.title;
    staticHeader.appendChild(staticHeaderContent);
    
    // Append header first
    fragment.appendChild(staticHeader);
    
    // Move all sanitized children to the fragment
    while (sanitizedClone.firstChild) {
        fragment.appendChild(sanitizedClone.firstChild);
    }

    const container = createDraggableContainer(snapshot.title, fragment, snapshot.id);
    container.classList.add('be-clone');
    container.dataset.originalId = snapshot.originalId;

    // Double-click to edit title
    const header = container.querySelector('.print-section-header');
    if (header) {
        header.addEventListener('dblclick', async (e) => {
            e.stopPropagation();
            const titleSpan = header.querySelector('span');
            const staticTitleSpan = container.querySelector(dom.selectors.CORE.GROUP_HEADER_CONTENT);
            const currentTitle = titleSpan ? titleSpan.textContent.trim() : (staticTitleSpan ? staticTitleSpan.textContent.trim() : 'Clone');
            // Use window reference for mockability in tests
            const newTitle = await (window.showInputModal || showInputModal)('Edit Clone Title', 'Enter new title:', currentTitle);
            if (newTitle) {
                if (titleSpan) titleSpan.textContent = newTitle;
                if (staticTitleSpan) staticTitleSpan.textContent = newTitle;
                showFeedback('Title updated');
            }
        });
    }

    // Delete button
    const actionContainer = getOrCreateActionContainer(container);
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'be-clone-delete';
    deleteBtn.innerHTML = '🗑️';
    deleteBtn.title = 'Delete Clone';
    deleteBtn.onclick = (e) => {
        e.stopPropagation();
        if (confirm('Delete this clone?')) {
            container.remove();
            showFeedback('Clone deleted');
            updateLayoutBounds();
        }
    };
    actionContainer.appendChild(deleteBtn);
    
    // Use saved styles if available (top level for persistence, snapshot.styles for immediate)
    const width = snapshot.width || (snapshot.styles && snapshot.styles.width);
    const height = snapshot.height || (snapshot.styles && snapshot.styles.height);
    const left = snapshot.left;
    const top = snapshot.top;
    const zIndex = snapshot.zIndex;

    if (width) container.style.width = width;
    if (height) container.style.height = height;
    if (zIndex) container.style.zIndex = zIndex;

    if (left && top) {
        container.style.left = left;
        container.style.top = top;
    } else {
        // Position it slightly offset from original or at top-left
        const original = document.getElementById(snapshot.originalId);
        if (original) {
            container.style.left = (parseInt(original.style.left) || 0) + 32 + 'px';
            container.style.top = (parseInt(original.style.top) || 0) + 32 + 'px';
            
            // Ensure it's in front of the original
            // Find max z-index in the layout
            let maxZ = 10;
            document.querySelectorAll('.print-section-container').forEach(el => {
                const z = parseInt(el.style.zIndex) || 10;
                if (z > maxZ) maxZ = z;
            });
            container.style.zIndex = maxZ + 1;
        } else {
            container.style.left = '32px';
            container.style.top = '32px';
        }
    }

    if (snapshot.minimized) {
        container.dataset.minimized = 'true';
        container.classList.add('minimized');
    }

    if (snapshot.compact) {
        container.classList.add('be-compact-mode');
        // Button style will be handled by injection or separate update if needed, 
        // but let's try to set it if button exists contextually (though injection happens later usually)
    }

    if (snapshot.borderStyle) {
        container.classList.add(snapshot.borderStyle);
    }

    const layoutRoot = document.getElementById('print-layout-wrapper');
    if (layoutRoot) {
        layoutRoot.appendChild(container);
    }

    // Re-init resize logic for the new container
    if (window.initResizeLogic) window.initResizeLogic();
    
    return container;
}

/**
 * Creates a floating decorative shape.
 */
function createShape(assetPath, restoreData = null) {
    const id = restoreData ? restoreData.id : `shape-${Date.now()}`;
    const content = document.createElement('div');
    content.className = 'be-shape-content';
    
    // Create container using the existing helper
    const container = createDraggableContainer('', content, id);
    container.classList.add('print-shape-container', 'be-shape');
    
    // Initial size
    container.style.width = '200px';
    container.style.height = '200px';
    
    // Removal logic (specific for shapes)
    const actionContainer = getOrCreateActionContainer(container);
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'be-shape-delete';
    deleteBtn.innerHTML = '🗑️';
    deleteBtn.title = 'Delete Shape';
    deleteBtn.onclick = (e) => {
        e.stopPropagation();
        if (confirm('Delete this shape?')) {
            container.remove();
            showFeedback('Shape deleted');
            updateLayoutBounds();
        }
    };
    actionContainer.appendChild(deleteBtn);

    // Asset Application
    container.dataset.assetPath = assetPath;
    applyShapeAsset(container, assetPath);
    
    // Z-Index Management (at least 100 higher than sections)
    let maxZ = 110;
    document.querySelectorAll('.print-section-container').forEach(el => {
        // Only count sections, not other shapes for the base 110 offset
        if (!el.classList.contains('print-shape-container')) {
            const z = parseInt(el.style.zIndex) || 10;
            if (z > maxZ - 100) maxZ = z + 100;
        } else {
            // But shapes should also stack on top of each other
            const z = parseInt(el.style.zIndex) || 110;
            if (z > maxZ) maxZ = z;
        }
    });
    container.style.zIndex = maxZ + 1;
    
    // Restore saved state
    if (restoreData) {
        if (restoreData.styles) {
            Object.assign(container.style, restoreData.styles);
        }
        if (restoreData.width) container.style.width = restoreData.width;
        if (restoreData.height) container.style.height = restoreData.height;
        if (restoreData.left) container.style.left = restoreData.left;
        if (restoreData.top) container.style.top = restoreData.top;
        if (restoreData.zIndex) container.style.zIndex = restoreData.zIndex;
    } else {
        container.style.left = '50px';
        container.style.top = '50px';
    }
    
    const layoutRoot = document.getElementById('print-layout-wrapper');
    if (layoutRoot) {
        layoutRoot.appendChild(container);
    }
    
    // Re-init resize logic
    if (window.initResizeLogic) window.initResizeLogic();
    
    return container;
}

/**
 * Helper to apply asset to a shape container via class or inline style.
 */
function applyShapeAsset(container, assetPath) {
    // Map of assets to existing border classes
    const assetToClassMap = {
        'assets/border_ability.gif': 'ability_border',
        'assets/border_spikes.gif': 'spikes_border',
        'assets/border_barbarian.gif': 'barbarian_border',
        'assets/border_goth1.gif': 'goth_border',
        'assets/border_plants.gif': 'plants_border',
        'assets/border_box.gif': 'box_border',
        'assets/dwarf.gif': 'dwarf_border',
        'assets/dwarf_hollow.gif': 'dwarf_hollow_border',
        'assets/sticks.gif': 'sticks_border',
        'assets/ornament.gif': 'ornament_border',
        'assets/ornament2.gif': 'ornament2_border',
        'assets/ornament_bold.gif': 'ornament_bold_border',
        'assets/ornament_bold2.gif': 'ornament_bold2_border',
        'assets/ornament_simple.gif': 'ornament_simple_border',
        'assets/spike_hollow.gif': 'spike_hollow_border',
        'assets/spiky.gif': 'spiky_border',
        'assets/spiky_bold.gif': 'spiky_bold_border',
        'assets/vine_holloow.gif': 'vine_border',
        'assets/border_default.png': 'default-border'
    };

    const className = assetToClassMap[assetPath];
    if (className) {
        container.classList.add(className);
    } else {
        // Generic handling for new assets in assets/shapes/
        container.style.borderStyle = 'solid';
        container.style.borderImageSource = `url('${chrome.runtime.getURL(assetPath)}')`;
        container.style.borderImageSlice = '33'; // Default slice
        container.style.borderImageWidth = '28px'; // Default width
        container.style.borderImageOutset = '16px'; // Default outset
        container.style.borderImageRepeat = 'round';
    }
}

/**
 * Creates and manages a floating spell detail section.
 */
async function createSpellDetailSection(spellName, coords, restoreData = null) {
    // 0. Check for existing section for this spell
    const existing = Array.from(document.querySelectorAll('.be-spell-detail'))
                          .find(el => {
                              const title = el.querySelector('.print-section-header span');
                              return title && title.textContent.trim() === spellName;
                          });
    if (existing && !restoreData) {
        // Bring to front
        let maxZ = 10000;
        document.querySelectorAll('.print-section-container').forEach(el => {
            const z = parseInt(el.style.zIndex) || 10;
            if (z > maxZ) maxZ = z;
        });
        existing.style.zIndex = maxZ + 1;
        if (existing.scrollIntoView) {
            existing.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        showFeedback(`${spellName} is already open`);
        return;
    }

    const id = restoreData ? restoreData.id : `spell-detail-${Date.now()}`;
    
    // 1. Create immediate shell
    const content = document.createElement('div');
    content.className = 'print-section-content';
    content.innerHTML = '<div class="be-spinner"></div>';
    
    const container = createDraggableContainer(spellName, content, id);
    container.classList.add('be-spell-detail', 'be-extracted-section');
    
    // Customize Header: Add Close Button (instead of/beside minimize)
    const header = container.querySelector('.print-section-header');
    if (header) {
        // Change existing X button to remove for spell details
            const xBtn = header.querySelector('.print-section-minimize');
            if (xBtn) {
                xBtn.title = 'Remove Section';
                xBtn.onclick = (e) => {
                    e.stopPropagation();
                    rollbackSection(container);
                };
            }
        
    }

    const layoutRoot = document.getElementById('print-layout-wrapper') || document.body;
    
    if (restoreData) {
        if (restoreData.left) container.style.setProperty('left', restoreData.left, 'important');
        if (restoreData.top) container.style.setProperty('top', restoreData.top, 'important');
        if (restoreData.width) container.style.setProperty('width', restoreData.width, 'important');
        if (restoreData.height) container.style.setProperty('height', restoreData.height, 'important');
        if (restoreData.zIndex) container.style.setProperty('z-index', restoreData.zIndex, 'important');
        
        if (restoreData.minimized) {
            container.dataset.minimized = 'true';
            container.classList.add('minimized');
        }
    } else {
        // Calculate relative coordinates to the layout wrapper
        const rootRect = layoutRoot.getBoundingClientRect();
        
        // Use clientX/Y but subtract parent Rect to account for transforms/scrolling parent
        const x = coords.x - rootRect.left;
        const y = coords.y - rootRect.top;

        container.style.position = 'absolute'; 
        container.style.left = `${x}px`;
        container.style.top = `${y}px`;
        container.style.width = '300px';
        container.style.height = 'auto';
        container.style.zIndex = '10000';
    }

    layoutRoot.appendChild(container);

    if (window.injectCloneButtons) window.injectCloneButtons(container);
    if (window.injectAppendButton) window.injectAppendButton(container);
    
    // 2. Fetch Data
    const spell = await fetchSpellWithCache(spellName);
    
    const contentWrapper = container.querySelector('.print-section-content');
    if (!contentWrapper) return;

    if (spell) {
        // 3. Render Data
        const dom = window.DomManager.getInstance();
        const header = document.createElement('div');
        header.className = dom.selectors.EXTRACTABLE.CONTENT_GROUP_HEADER.substring(1);
        const headerContent = document.createElement('div');
        headerContent.className = dom.selectors.CORE.GROUP_HEADER_CONTENT.substring(1);
        headerContent.textContent = spell.name;
        header.appendChild(headerContent);

        contentWrapper.innerHTML = `
            <div style="padding: 10px; color: black; background: white;">
                <div style="font-weight: bold; border-bottom: 1px solid #ccc; margin-bottom: 5px; padding-bottom: 2px;">
                    Level ${spell.level} ${spell.school}
                </div>
                <div style="margin-bottom: 10px; font-style: italic; font-size: 0.9em;">
                    Range: ${spell.range}
                </div>
                <div class="spell-description" style="white-space: pre-wrap; font-size: 13px;">${spell.description}</div>
            </div>
        `;
        contentWrapper.prepend(header);
    } else {
        // 4. Render Error
        contentWrapper.innerHTML = `
            <div style="padding: 15px; color: #721c24; background: #f8d7da; border: 1px solid #f5c6cb; border-radius: 4px;">
                Only previously loaded spells and current ones from the original section are available. 
                Please add the spell from the manage spells button and try again.
                <div class="be-error-actions">
                    <button class="ct-theme-button be-retry-button">Retry</button>
                    <button class="ct-theme-button be-delete-button">Delete</button>
                </div>
            </div>
        `;
        
        contentWrapper.querySelector('.be-delete-button').onclick = () => container.remove();
        contentWrapper.querySelector('.be-retry-button').onclick = () => {
            contentWrapper.innerHTML = '<div class="be-spinner"></div>';
            createSpellDetailSection(spellName, coords);
            container.remove(); // Replace old with new
        };
    }

    // Re-init resize logic for the new container
    if (window.initResizeLogic) window.initResizeLogic();
    updateLayoutBounds();

    return container;
}

/**
 * Gets the character ID from the URL.
 */
function getCharacterId() {
    return window.location.pathname.split('/').pop();
}

/**
 * Retrieves a spell from cache or API.
 */
async function fetchSpellWithCache(spellName) {
    try {
        await Storage.init();
        
        // 1. Check Cache
        const cached = await Storage.getSpell(spellName);
        if (cached) {
            console.log(`[DDB Print] Cache Hit: ${spellName}`);
            return cached;
        }

        console.log(`[DDB Print] Cache Miss: ${spellName}. Fetching all spells...`);

        // 2. Fetch API on miss
        const charId = getCharacterId();
        if (!charId || charId === 'characters') {
            console.error('[DDB Print] Could not determine character ID for spell fetch');
            return null;
        }

        const spells = await getCharacterSpells(charId);
        if (spells && spells.length > 0) {
            // 3. Update Cache with ALL spells
            await Storage.saveSpells(spells);
            
            // 4. Return the specific spell
            return spells.find(s => s.name === spellName) || null;
        }
    } catch (err) {
        console.error('[DDB Print] Error in fetchSpellWithCache', err);
    }
    return null;
}

async function getCharacterSpells(charId) {
    const url = `https://character-service.dndbeyond.com/character/v5/character/${charId}`;
    
    try {
        // In MV3, cross-origin fetch must be done from background script
        const response = await new Promise((resolve) => {
            chrome.runtime.sendMessage({ type: 'FETCH_CHARACTER_DATA', url }, (result) => {
                resolve(result);
            });
        });

        if (!response || !response.success) {
            throw new Error(response ? response.error : "Could not fetch character data via background.");
        }
        
        const json = response.data;
        const data = json.data;

        // D&D Beyond stores spells in multiple arrays (Race, Class, Feats, etc.)
        // We flatten them all into one list
        const spellSources = [
            ...(data.classSpells || []),
            ...(data.spells.race || []),
            ...(data.spells.class || []),
            ...(data.spells.feat || []),
            ...(data.spells.item || [])
        ];

        // Some sources (like classSpells) are nested differently
        const spells = [];
        
        spellSources.forEach(source => {
            // Handle class-specific nested spells
            if (source.spells) {
                source.spells.forEach(s => spells.push(s.definition));
            } 
            // Handle flat spell objects (items/feats/race)
            else if (source.definition) {
                spells.push(source.definition);
            }
        });

        // Map it to a cleaner format (Name + Description)
        return spells.map(s => ({
            name: s.name,
            level: s.level,
            description: s.description.replace(/<[^>]*>?/gm, ''), // Strips HTML tags
            range: `${s.range.rangeValue || ''} ${s.range.origin}`,
            school: s.school
        }));

    } catch (err) {
        console.error("Error fetching spells:", err);
    }
}
/**
 * All available border style classes.
 */
const ALL_BORDER_STYLES = [
    'default-border', 'no-border', 'ability_border', 'spikes_border',
    'barbarian_border', 'goth_border', 'plants_border', 'box_border',
    'dwarf_border', 'dwarf_hollow_border', 'sticks_border', 'ornament_border', 'ornament2_border',
    'ornament_bold_border', 'ornament_bold2_border', 'ornament_simple_border',
    'spike_hollow_border', 'spiky_border', 'spiky_bold_border', 'vine_border'
];

/**
 * Removes all border style classes from an element.
 */
function clearBorderStyles(el) {
    if (!el) return;
    el.classList.remove(...ALL_BORDER_STYLES);
}

/**
 * Shows a modal with an input field.
 * @returns {Promise<string|null>}
 */
function showInputModal(title, message, defaultValue = '') {
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.className = 'be-modal-overlay';
        
        const modal = document.createElement('div');
        modal.className = 'be-modal';
        
        const h3 = document.createElement('h3');
        h3.textContent = title;
        modal.appendChild(h3);
        
        const p = document.createElement('p');
        p.textContent = message;
        modal.appendChild(p);
        
        const input = document.createElement('input');
        input.type = 'text';
        input.value = defaultValue;
        modal.appendChild(input);
        
        const actions = document.createElement('div');
        actions.className = 'be-modal-actions';
        
        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'be-modal-cancel';
        cancelBtn.textContent = 'Cancel';
        cancelBtn.onclick = () => {
            overlay.remove();
            resolve(null);
        };
        actions.appendChild(cancelBtn);
        
        const okBtn = document.createElement('button');
        okBtn.className = 'be-modal-ok';
        okBtn.textContent = 'OK';
        okBtn.onclick = () => {
            const val = input.value;
            overlay.remove();
            resolve(val);
        };
        actions.appendChild(okBtn);
        
        modal.appendChild(actions);
        overlay.appendChild(modal);
        document.body.appendChild(overlay);
        
        input.focus();
        input.select();
        
        // Handle Enter/Esc
        input.onkeydown = (e) => {
            if (e.key === 'Enter') okBtn.click();
            if (e.key === 'Escape') cancelBtn.click();
        };
    });
}

/**
 * Shows a modal to pick a border style.
 * @param {string} currentStyle The current border class name.
 * @returns {Promise<{style: string, applyToAll: boolean}|null>}
 */
function showBorderPickerModal(currentStyle = 'default-border') {
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.className = 'be-modal-overlay';
        
        const modal = document.createElement('div');
        modal.className = 'be-modal';
        modal.style.width = '450px';
        
        const h3 = document.createElement('h3');
        h3.textContent = 'Select Section Border';
        modal.appendChild(h3);
        
        const optionsContainer = document.createElement('div');
        optionsContainer.className = 'be-border-options';
        
        const styles = [
            { id: 'default-border', label: 'Default' },
            { id: 'no-border', label: 'None' },
            { id: 'ability_border', label: 'Ability' },
            { id: 'spikes_border', label: 'Spikes' },
            { id: 'barbarian_border', label: 'Barbarian' },
            { id: 'goth_border', label: 'Goth' },
            { id: 'plants_border', label: 'Plants' },
            { id: 'box_border', label: 'Box' },
            { id: 'dwarf_border', label: 'Dwarf' },
            { id: 'dwarf_hollow_border', label: 'Dwarf Hollow' },
            { id: 'sticks_border', label: 'Sticks' },
            { id: 'ornament_border', label: 'Ornament 1' },
            { id: 'ornament2_border', label: 'Ornament 2' },
            { id: 'ornament_bold_border', label: 'Ornament Bold' },
            { id: 'ornament_bold2_border', label: 'Ornament Bold 2' },
            { id: 'ornament_simple_border', label: 'Ornament Simple' },
            { id: 'spike_hollow_border', label: 'Spike Hollow' },
            { id: 'spiky_border', label: 'Spiky' },
            { id: 'spiky_bold_border', label: 'Spiky Bold' },
            { id: 'vine_border', label: 'Vine' }
        ];
        
        let selectedStyle = currentStyle || 'default-border';
        const optionEls = [];

        styles.forEach(style => {
            const opt = document.createElement('div');
            opt.className = 'be-border-option';
            if (selectedStyle === style.id) opt.classList.add('selected');
            
            const preview = document.createElement('div');
            preview.className = `be-border-preview ${style.id}`;
            opt.appendChild(preview);
            
            const label = document.createElement('div');
            label.textContent = style.label;
            label.style.fontSize = '12px';
            opt.appendChild(label);
            
            opt.onclick = () => {
                optionEls.forEach(el => el.classList.remove('selected'));
                opt.classList.add('selected');
                selectedStyle = style.id;
            };
            
            optionEls.push(opt);
            optionsContainer.appendChild(opt);
        });
        
        modal.appendChild(optionsContainer);
        
        const actions = document.createElement('div');
        actions.className = 'be-modal-actions';
        
        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'be-modal-cancel';
        cancelBtn.textContent = 'Cancel';
        cancelBtn.onclick = () => {
            overlay.remove();
            resolve(null);
        };
        actions.appendChild(cancelBtn);
        
        const okBtn = document.createElement('button');
        okBtn.className = 'be-modal-ok';
        okBtn.textContent = 'Apply';
        okBtn.onclick = () => {
            overlay.remove();
            resolve({
                style: selectedStyle
            });
        };
        actions.appendChild(okBtn);
        
        modal.appendChild(actions);
        overlay.appendChild(modal);
        document.body.appendChild(overlay);
        
        // Handle Esc
        window.addEventListener('keydown', function escHandler(e) {
            if (e.key === 'Escape') {
                cancelBtn.click();
                window.removeEventListener('keydown', escHandler);
            }
            if (e.key === 'Enter') {
                okBtn.click();
                window.removeEventListener('keydown', escHandler);
            }
        });
    });
}

/**
 * Shows a modal to pick a decorative shape or border asset.
 * @returns {Promise<{assetPath: string}|null>}
 */
function showShapePickerModal(currentAsset = '') {
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.className = 'be-modal-overlay';
        
        const modal = document.createElement('div');
        modal.className = 'be-modal';
        modal.style.width = '550px';
        
        const h3 = document.createElement('h3');
        h3.textContent = 'Select Decorative Shape';
        modal.appendChild(h3);
        
        const optionsContainer = document.createElement('div');
        optionsContainer.className = 'be-border-options';
        optionsContainer.style.maxHeight = '400px';
        optionsContainer.style.overflowY = 'auto';
        
        const assets = [
            // Custom Shapes (Planned for assets/shapes/)
            { path: 'assets/shapes/dwarf.gif', label: 'Dwarf (Shape)' },
            { path: 'assets/shapes/ornament.gif', label: 'Ornament (Shape)' },
            // Standard Borders
            { path: 'assets/border_default.png', label: 'Default' },
            { path: 'assets/border_ability.gif', label: 'Ability' },
            { path: 'assets/border_spikes.gif', label: 'Spikes' },
            { path: 'assets/border_barbarian.gif', label: 'Barbarian' },
            { path: 'assets/border_goth1.gif', label: 'Goth' },
            { path: 'assets/border_plants.gif', label: 'Plants' },
            { path: 'assets/border_box.gif', label: 'Box' },
            { path: 'assets/dwarf.gif', label: 'Dwarf' },
            { path: 'assets/dwarf_hollow.gif', label: 'Dwarf Hollow' },
            { path: 'assets/sticks.gif', label: 'Sticks' },
            { path: 'assets/ornament.gif', label: 'Ornament 1' },
            { path: 'assets/ornament2.gif', label: 'Ornament 2' },
            { path: 'assets/ornament_bold.gif', label: 'Ornament Bold' },
            { path: 'assets/ornament_bold2.gif', label: 'Ornament Bold 2' },
            { path: 'assets/ornament_simple.gif', label: 'Ornament Simple' },
            { path: 'assets/spike_hollow.gif', label: 'Spike Hollow' },
            { path: 'assets/spiky.gif', label: 'Spiky' },
            { path: 'assets/spiky_bold.gif', label: 'Spiky Bold' },
            { path: 'assets/vine_holloow.gif', label: 'Vine' }
        ];
        
        let selectedAsset = currentAsset || assets[0].path;
        const optionEls = [];

        assets.forEach(asset => {
            const opt = document.createElement('div');
            opt.className = 'be-border-option';
            if (selectedAsset === asset.path) opt.classList.add('selected');
            
            const preview = document.createElement('div');
            preview.className = `be-border-preview`;
            // Manually apply border-image for preview since we don't have classes for all
            // Note: Reuse existing classes if they map to the path
            const assetToClassMap = {
                'assets/border_ability.gif': 'ability_border',
                'assets/border_spikes.gif': 'spikes_border',
                'assets/border_barbarian.gif': 'barbarian_border',
                'assets/border_goth1.gif': 'goth_border',
                'assets/border_plants.gif': 'plants_border',
                'assets/border_box.gif': 'box_border',
                'assets/dwarf.gif': 'dwarf_border',
                'assets/dwarf_hollow.gif': 'dwarf_hollow_border',
                'assets/sticks.gif': 'sticks_border',
                'assets/ornament.gif': 'ornament_border',
                'assets/ornament2.gif': 'ornament2_border',
                'assets/ornament_bold.gif': 'ornament_bold_border',
                'assets/ornament_bold2.gif': 'ornament_bold2_border',
                'assets/ornament_simple.gif': 'ornament_simple_border',
                'assets/spike_hollow.gif': 'spike_hollow_border',
                'assets/spiky.gif': 'spiky_border',
                'assets/spiky_bold.gif': 'spiky_bold_border',
                'assets/vine_holloow.gif': 'vine_border',
                'assets/border_default.png': 'default-border'
            };
            const className = assetToClassMap[asset.path];
            if (className) {
                preview.classList.add(className);
            } else {
                preview.style.borderStyle = 'solid';
                preview.style.borderImageSource = `url('${chrome.runtime.getURL(asset.path)}')`;
                preview.style.borderImageSlice = '33';
                preview.style.borderImageWidth = '20px';
            }
            
            opt.appendChild(preview);
            
            const label = document.createElement('div');
            label.textContent = asset.label;
            label.style.fontSize = '12px';
            opt.appendChild(label);
            
            opt.onclick = () => {
                optionEls.forEach(el => el.classList.remove('selected'));
                opt.classList.add('selected');
                selectedAsset = asset.path;
            };
            
            optionEls.push(opt);
            optionsContainer.appendChild(opt);
        });
        
        modal.appendChild(optionsContainer);
        
        const actions = document.createElement('div');
        actions.className = 'be-modal-actions';
        
        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'be-modal-cancel';
        cancelBtn.textContent = 'Cancel';
        cancelBtn.onclick = () => {
            overlay.remove();
            resolve(null);
        };
        actions.appendChild(cancelBtn);
        
        const okBtn = document.createElement('button');
        okBtn.className = 'be-modal-ok';
        okBtn.textContent = 'Add Shape';
        okBtn.onclick = () => {
            overlay.remove();
            resolve({
                assetPath: selectedAsset
            });
        };
        actions.appendChild(okBtn);
        
        modal.appendChild(actions);
        overlay.appendChild(modal);
        document.body.appendChild(overlay);
        
        // Handle Esc
        window.addEventListener('keydown', function escHandler(e) {
            if (e.key === 'Escape') {
                cancelBtn.click();
                window.removeEventListener('keydown', escHandler);
            }
            if (e.key === 'Enter') {
                okBtn.click();
                window.removeEventListener('keydown', escHandler);
            }
        });
    });
}

/**
 * Initializes ResizeObserver to scale content to fit its container.
 */
function initResponsiveScaling() {
    const observer = new ResizeObserver(entries => {
        for (const entry of entries) {
            const container = entry.target;
            const content = container.querySelector('.print-section-content');
            const inner = content ? content.firstElementChild : null;
            
            if (!inner) continue;

            // Reset scaling to measure natural size
            inner.style.transform = 'none';
            inner.style.width = '100%';
            
            const containerWidth = content.clientWidth;
            const containerHeight = content.clientHeight;
            const contentWidth = inner.scrollWidth;
            const contentHeight = inner.scrollHeight;

            if (contentWidth > containerWidth || contentHeight > containerHeight) {
                const scaleX = containerWidth / contentWidth;
                const scaleY = containerHeight / contentHeight;
                const scale = Math.min(scaleX, scaleY, 1);
                
                if (scale < 1) {
                    inner.style.transform = `scale(${scale})`;
                    inner.style.width = `${100 / scale}%`; // Counteract scale for width to prevent shrinking
                    container.setAttribute('data-scaling', 'true');
                } else {
                    container.removeAttribute('data-scaling');
                }
            } else {
                container.removeAttribute('data-scaling');
            }
        }
    });

    document.querySelectorAll('.print-section-container').forEach(container => {
    });
}

/**
 * Handles Z-Index for click-to-front behavior
 */
function initZIndexManagement() {
    const container = document.getElementById('print-layout-wrapper');
    if (!container) return;

    container.addEventListener('mousedown', (e) => {
        const clickedEl = e.target.closest('.print-section-container');
        if (!clickedEl) return;

        const isShape = clickedEl.classList.contains('print-shape-container');
        const allElements = document.querySelectorAll('.print-section-container');
        
        let maxSectionZ = 10;
        let maxShapeZ = 110;

        allElements.forEach(el => {
            const z = parseInt(window.getComputedStyle(el).zIndex) || 10;
            if (el.classList.contains('print-shape-container')) {
                if (z > maxShapeZ) maxShapeZ = z;
            } else {
                if (z > maxSectionZ) maxSectionZ = z;
            }
        });

        if (isShape) {
            // Shapes always on top of sections and front of other shapes
            clickedEl.style.zIndex = Math.max(maxShapeZ, maxSectionZ + 100) + 1;
        } else {
            // Sections stay below shapes (usually < 110)
            clickedEl.style.zIndex = maxSectionZ + 1;
            
            // Defensive: if section z-index reaches the shape threshold (110)
            // we might need to cap it or rebase, but for now we'll just keep it simple.
            // Most characters won't have 100 sections.
        }
    });
}


/**
 * Automatically arranges sections in a masonry-like grid
 */
function autoArrangeSections() {
    const sections = Array.from(document.querySelectorAll('.print-section-container'));
    if (sections.length === 0) return;

    const viewportWidth = window.innerWidth || 1200; // Fallback
    let currentX = 10;
    let currentY = 10;
    let rowHeight = 0;
    const gutter = 15;
    let columnsInRow = 0;

    sections.forEach(section => {
        section.style.left = '0px';
        section.style.top = '0px'; 

        const width = section.offsetWidth || 300;
        const height = section.offsetHeight || 150;

        // Check if we need a new row:
        // 1. If it doesn't fit horizontally
        // 2. OR if we've reached the 3-column limit
        if ((currentX + width > viewportWidth - 20 && currentX > 10) || columnsInRow >= 3) {
            // New row
            currentX = 10;
            currentY += rowHeight + gutter;
            rowHeight = 0;
            columnsInRow = 0;
        }

        // Snap to grid
        const snapX = Math.round(currentX / 16) * 16;
        const snapY = Math.round(currentY / 16) * 16;

        section.style.left = `${snapX}px`;
        section.style.top = `${snapY}px`;
        
        currentX += width + gutter;
        if (height > rowHeight) rowHeight = height;
        columnsInRow++;
    });
    
    updateLayoutBounds();
}

/**
 * Custom Resize Logic for 16px Grid Snapping
 */
function initResizeLogic() {
    // Add resize handles if not present
    document.querySelectorAll('.print-section-container').forEach(section => {
        if (!section.querySelector('.print-section-resize-handle')) {
            const handle = document.createElement('div');
            handle.className = 'print-section-resize-handle';
            section.appendChild(handle);
            
            handle.addEventListener('mousedown', initResize);
        }
    });

    let resizingSection = null;
    let startX, startY, startWidth, startHeight;

    function initResize(e) {
        resizingSection = e.target.closest('.print-section-container');
        startX = e.clientX;
        startY = e.clientY;
        startWidth = parseInt(window.getComputedStyle(resizingSection).width, 10);
        startHeight = parseInt(window.getComputedStyle(resizingSection).height, 10);
        
        document.documentElement.addEventListener('mousemove', doResize, false);
        document.documentElement.addEventListener('mouseup', stopResize, false);
        e.stopPropagation();
        e.preventDefault();
    }

    function doResize(e) {
        if (!resizingSection) return;
        
        // Calculate raw new dimensions
        let rawNewWidth = startWidth + (e.clientX - startX);
        let rawNewHeight = startHeight + (e.clientY - startY);
        
        // Snap to 16px
        let newWidth = Math.round(rawNewWidth / 16) * 16;
        let newHeight = Math.round(rawNewHeight / 16) * 16;
        
        // Min dimensions
        if (newWidth < 50) newWidth = 48; // nearest 16 is 48
        if (newHeight < 30) newHeight = 32;

        resizingSection.style.width = newWidth + 'px';
        resizingSection.style.height = newHeight + 'px';
    }

    function stopResize() {
        if (resizingSection) {
            const finalWidth = parseInt(resizingSection.style.width, 10);
            // Ensure finalWidth is valid number, fallback to computed if needed (though doResize sets style)
            if (!isNaN(finalWidth)) {
                const deltaX = finalWidth - startWidth;
                if (deltaX !== 0) {
                    adjustInnerContentWidth(resizingSection, deltaX);
                }
            }
        }

        resizingSection = null;
        document.documentElement.removeEventListener('mousemove', doResize, false);
        document.documentElement.removeEventListener('mouseup', stopResize, false);
        updateLayoutBounds();
    }
}

/**
 * Adjusts the width of immediate children of specific containers based on resize delta.
 */
function adjustInnerContentWidth(section, deltaX) {
    // User Request: Scan for containers ending in "-row-header" or "-content"
    const containers = section.querySelectorAll('div[class$="-row-header"], div[class$="-content"]');
    
    // Find the master parent content width
    const parentContent = section.querySelector('.print-section-content');
    if (!parentContent) return;

    // Use padding-box width (clientWidth) or computed width
    // The previous logic relied on delta, but user wants EXACT match to parent.
    // However, .print-section-content might have padding, so inner divs should likely match CLIENT width.
    const parentWidth = parentContent.clientWidth;

    if (!parentWidth) return;

    containers.forEach(container => {
        // User Request: Override width of IMMEDIATE divs
        Array.from(container.children).forEach(child => {
            if (child.tagName === 'DIV') {
                // Set width to match the PARENT content width
                child.style.setProperty('width', `${parentWidth}px`, 'important');
                child.style.setProperty('min-width', `${parentWidth}px`, 'important');
            }
        });
    });
}

/**
 * Updates the size of the layout wrapper to fit all sections
 */
function updateLayoutBounds() {
    const container = document.getElementById('print-layout-wrapper');
    if (!container) return;

    let maxBottom = 0;
    let maxRight = 0;

    const sections = Array.from(document.querySelectorAll('.print-section-container'));
    sections.forEach(section => {
        // Use getBoundingClientRect for accurate visual position relative to viewport/page
        // BUT stick to style parsing for relative-to-parent calculation if parent is 0,0
        // Since sections are absolute in a relative container, style.top is relative to container top.
        const top = parseInt(section.style.top) || 0;
        const left = parseInt(section.style.left) || 0;
        const width = section.offsetWidth || 0;
        const height = section.offsetHeight || 0;

        const bottom = top + height;
        const right = left + width;

        if (bottom > maxBottom) maxBottom = bottom;
        if (right > maxRight) maxRight = right;
    });

    // Add padding (e.g., 50px)
    const newHeight = maxBottom + 50;
    const newWidth = maxRight + 50;

    // Apply min-height/width to ensure it at least covers the viewport
    // User Request: Update body container height to always be at least the same height as furthest coordinate
    
    // 1. Update the wrapper itself
    const minH = Math.max(newHeight, window.innerHeight) + 'px';
    container.style.minHeight = minH;
    container.style.height = minH; // Explicitly set height too just in case
    container.style.minWidth = Math.max(newWidth, window.innerWidth) + 'px';

    // 2. Also attempt to update parent containers if they restrict height
    let sheetDesktop, sheetInner;
    if (window.DomManager) {
        const desktopWrapper = window.DomManager.getInstance().getCharacterSheet();
        sheetDesktop = desktopWrapper ? desktopWrapper.element : null;
        
        const innerWrapper = window.DomManager.getInstance().getSheetInner();
        sheetInner = innerWrapper ? innerWrapper.element : null;
    } else {
        sheetDesktop = document.querySelector('.ct-character-sheet-desktop');
        sheetInner = document.querySelector('.ct-character-sheet__inner');
    }

    if (sheetDesktop) {
        sheetDesktop.style.minHeight = minH;
        // height: auto is usually enough on parent if child pushes it, but flex/grid/absolute might interfere
        sheetDesktop.style.height = 'auto'; 
    }
    
    if (sheetInner) {
         sheetInner.style.minHeight = minH;
    }

    drawPageSeparators(newHeight, 1200);
}

/**
 * Creates the floating control panel.
 */
function createControls() {
    const container = document.createElement('div');
    container.id = 'print-enhance-controls';
    container.style.position = 'fixed';
    container.style.top = '10px';
    container.style.left = '10px';
    container.style.zIndex = '10000';
    container.style.background = '#222';
    container.style.border = '1px solid #444';
    container.style.padding = '8px';
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.gap = '8px';
    container.style.borderRadius = '8px';
    container.style.boxShadow = '0 4px 15px rgba(0,0,0,0.5)';
    container.style.transition = 'opacity 0.3s, transform 0.3s';
    
    // Hover logic
    container.addEventListener('mouseenter', () => {
        container.style.transform = 'scale(1.02)';
    });
    container.addEventListener('mouseleave', () => {
        container.style.transform = 'scale(1)';
    });

    const buttons = [
        { label: 'Load', icon: '📂', action: handleLoadFile },
        { label: 'Reset to Default', icon: '🔄', action: handleLoadDefault },
        { label: 'Manage Clones', icon: '📋', action: handleManageClones },
        { label: 'Manage Compact', icon: '📏', action: handleManageCompact },
        { label: 'Print', icon: '🖨️', action: () => window.print() },
        { label: 'Save to Browser', icon: '💾', action: handleSaveBrowser },
        { label: 'Save to PC', icon: '💻', action: handleSavePC },
        { 
            label: 'Bugs & Feature Request', 
            icon: '🐛', 
            action: () => window.open('https://github.com/luiscla27/beyond-print-enhancer/issues', '_blank') 
        },
        { 
            label: 'Contribute', 
            icon: '⭐', 
            action: () => window.open('https://github.com/luiscla27/beyond-print-enhancer', '_blank'), 
            bgLightColor: '#a79863',
            bgColor: '#73611d'
        }
    ];

    buttons.forEach(btnInfo => {
        const btn = document.createElement('button');
        btn.innerHTML = `<span style="margin-right: 5px;">${btnInfo.icon}</span> ${btnInfo.label}`;
        btn.style.backgroundColor = btnInfo.bgColor || '#333';
        btn.style.color = 'white';
        btn.style.border = '1px solid #555';
        btn.style.padding = '6px 12px';
        btn.style.borderRadius = '4px';
        btn.style.cursor = 'pointer';
        btn.style.fontSize = '12px';
        btn.style.textAlign = 'left';
        btn.style.transition = 'background-color 0.2s';
        
        btn.onmouseenter = () => btn.style.backgroundColor = btnInfo.bgLightColor || '#444';
        btn.onmouseleave = () => btn.style.backgroundColor = btnInfo.bgColor || '#333';
        btn.onclick = btnInfo.action;
        
        container.appendChild(btn);
    });

    document.body.appendChild(container);
    
    // Inject print-only styles to hide controls
    if (!document.getElementById('ddb-print-controls-style')) {
        const style = document.createElement('style');
        style.id = 'ddb-print-controls-style';
        style.textContent = '@media print { #print-enhance-controls, #print-enhance-overlay { display: none !important; } }';
        document.head.appendChild(style);
    }
}

/**
 * Shows a modal to manage Compact Mode status for named sections.
 */
function handleManageCompact() {
    // Find all sections that are candidates for compact mode logic
    // Criteria: Named sections (excluding section-\d+), or clones of named sections.
    const allSections = Array.from(document.querySelectorAll('.print-section-container'));
    
    const candidates = allSections.filter(section => {
        const sourceId = section.dataset.originalId || section.id || '';
        const isNumbered = /^section-Section-\d+$/.test(sourceId);
        return sourceId && !isNumbered; // Only named sections
    });

    if (candidates.length === 0) {
        showFeedback('No compact-compatible sections found');
        return;
    }

    // Modal
    const overlay = document.createElement('div');
    overlay.className = 'be-modal-overlay';
    
    const modal = document.createElement('div');
    modal.className = 'be-modal';
    modal.style.width = '500px';
    
    const h3 = document.createElement('h3');
    h3.textContent = 'Manage Compact Mode';
    modal.appendChild(h3);

    // Toggle All Button
    const toggleAllBtn = document.createElement('button');
    toggleAllBtn.textContent = 'Toggle All';
    toggleAllBtn.className = 'be-modal-ok'; // Reusing style
    toggleAllBtn.style.marginBottom = '10px';
    toggleAllBtn.style.alignSelf = 'flex-start';
    
    // Check if majority are currently compact to decide initial toggle direction
    const compactCount = candidates.filter(s => s.classList.contains('be-compact-mode')).length;
    const allCompact = compactCount === candidates.length;
    
    toggleAllBtn.onclick = () => {
        const newState = !allCompact; // If all are on, turn off. Otherwise turn on.
        candidates.forEach(section => {
             // Update class
            if (newState) section.classList.add('be-compact-mode');
            else section.classList.remove('be-compact-mode');
            
            // Sync button style if present
            const btn = section.querySelector('.be-compact-button');
            if (btn) {
                 btn.style.backgroundColor = newState ? 'var(--btn-color)' : 'var(--btn-color-highlight)';
            }
        });
        updateLayoutBounds();
        overlay.remove();
        showFeedback(newState ? 'All sections compacted' : 'All sections expanded');
    };
    modal.appendChild(toggleAllBtn);

    
    const list = document.createElement('div');
    list.style.maxHeight = '300px';
    list.style.overflowY = 'auto';
    list.style.display = 'flex';
    list.style.flexDirection = 'column';
    list.style.gap = '8px';
    
    candidates.forEach(section => {
        const item = document.createElement('div');
        item.style.display = 'flex';
        item.style.justifyContent = 'space-between';
        item.style.alignItems = 'center';
        item.style.padding = '8px';
        item.style.background = '#333';
        item.style.borderRadius = '4px';
        
        const titleSpan = section.querySelector('.print-section-header span, .ct-subsection__header, .ct-section__header');
        const name = titleSpan ? titleSpan.textContent.trim() : (section.id || 'Unnamed');
        
        const nameLabel = document.createElement('span');
        nameLabel.textContent = name;
        item.appendChild(nameLabel);
        
        const toggleBtn = document.createElement('button');
        const isCompact = section.classList.contains('be-compact-mode');
        toggleBtn.textContent = isCompact ? 'ON' : 'OFF';
        toggleBtn.style.backgroundColor = isCompact ? '#4CAF50' : '#f44336';
        toggleBtn.style.color = 'white';
        toggleBtn.style.border = 'none';
        toggleBtn.style.padding = '4px 8px';
        toggleBtn.style.borderRadius = '4px';
        toggleBtn.style.cursor = 'pointer';
        
        toggleBtn.onclick = () => {
            const newState = section.classList.toggle('be-compact-mode');
            toggleBtn.textContent = newState ? 'ON' : 'OFF';
            toggleBtn.style.backgroundColor = newState ? '#4CAF50' : '#f44336';
            
            // Sync the manual button on the section if it exists
            const manualBtn = section.querySelector('.be-compact-button');
            if (manualBtn) {
                manualBtn.style.backgroundColor = newState ? 'var(--btn-color)' : 'var(--btn-color-highlight)';
            }
            updateLayoutBounds();
        };
        
        item.appendChild(toggleBtn);
        list.appendChild(item);
    });
    
    modal.appendChild(list);
    
    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'Close';
    closeBtn.className = 'be-modal-ok';
    closeBtn.style.marginTop = '10px';
    closeBtn.onclick = () => overlay.remove();
    modal.appendChild(closeBtn);
    
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
}

/**
 * Handles saving the layout to IndexedDB.
 */
async function handleSaveBrowser() {
    try {
        await Storage.init();
        const layout = await scanLayout();
        await Storage.saveGlobalLayout(layout);
        
        // Also save for specific character for the "revert to character" feature later
        const characterId = getCharacterId();
        if (characterId) {
            await Storage.saveLayout(characterId, layout);
        }
        
        showFeedback('Saved to browser!');
    } catch (err) {
        console.error('[DDB Print] Save failed', err);
        alert('Failed to save layout to browser.');
    }
}

/**
 * Handles saving to PC.
 */
async function handleSavePC() {
    const layout = await scanLayout();
    const data = JSON.stringify(layout, null, 2);
    const filename = `ddb-layout-${new Date().toISOString().split('T')[0]}.json`;

    try {
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        
        setTimeout(() => {
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        }, 0);
        
        showFeedback('Download started!');
    } catch (err) {
        console.error('[DDB Print] Download failed, showing modal', err);
        showFallbackModal(data);
    }
}

/**
 * Applies the hardcoded default layout.
 */
function applyDefaultLayout() {
    console.log('[DDB Print] Applying Default Layouts...');
    for (const [id, styles] of Object.entries(DEFAULT_LAYOUTS)) {
        const section = document.getElementById(id);
        if (section) {
            console.log(`[DDB Print] Applying defaults to ${id}`, styles);
            // Explicitly set properties to ensure they take effect
            for (const [prop, val] of Object.entries(styles)) {
                if (prop === 'borderStyle') {
                    section.classList.remove('default-border', 'ability_border', 'spikes_border', 'barbarian_border', 'goth_border', 'plants_border', 'box_border', 'no-border');
                    if (val) section.classList.add(val);
                } else if (['left', 'top', 'width', 'height', 'zIndex'].includes(prop)) {
                    // Fix: setProperty requires kebab-case for z-index
                    const cssProp = prop === 'zIndex' ? 'z-index' : prop;
                    section.style.setProperty(cssProp, val, 'important');
                } else if (prop === 'minimized') {
                    section.classList.toggle('minimized', !!val);
                } else if (prop === 'compact') {
                    section.classList.toggle('be-compact-mode', !!val);
                }
                // innerWidths handled separately or ignored here
            }
        } else {
            console.warn(`[DDB Print] Default layout target not found: ${id}`);
        }
    }
    updateLayoutBounds();
}

/**
 * Handles loading default layout.
 */
async function handleLoadDefault() {
    if (!confirm('This will reset your layout to defaults. Are you sure?')) return;

    try {
        await Storage.init();
        
        // Remove from IndexedDB
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        store.delete('GLOBAL');
        
        const characterId = getCharacterId();
        if (characterId) {
            store.delete(characterId);
        }

        // Reset styles in DOM
        document.querySelectorAll('.print-section-container').forEach(section => {
            section.style.left = '';
            section.style.top = '';
            section.style.width = '';
            section.style.height = '';
            section.style.zIndex = '10';
            section.dataset.minimized = 'false';
            
            const content = section.querySelector('.print-section-content');
            if (content) content.style.display = 'flex';

            // Reset inner widths
            const inners = section.querySelectorAll('div[class$="-row-header"], div[class$="-content"] div');
            inners.forEach(el => {
                if (el.tagName === 'DIV') {
                    el.style.width = '';
                    el.style.minWidth = '';
                }
            });
        });

        // Trigger default layout
        applyDefaultLayout();

        // Reposition clones in front of their parents
        document.querySelectorAll('.print-section-container.be-clone').forEach(clone => {
            const originalId = clone.dataset.originalId;
            const original = document.getElementById(originalId);
            if (original) {
                const x = (parseInt(original.style.left) || 0) + 32;
                const y = (parseInt(original.style.top) || 0) + 32;
                clone.style.setProperty('left', `${x}px`, 'important');
                clone.style.setProperty('top', `${y}px`, 'important');
                
                // Maintain current dimensions if they exist, otherwise they might be reset by the global query
                const currentWidth = clone.style.width;
                const currentHeight = clone.style.height;
                if (currentWidth) clone.style.setProperty('width', currentWidth, 'important');
                if (currentHeight) clone.style.setProperty('height', currentHeight, 'important');

                clone.style.zIndex = (parseInt(original.style.zIndex) || 10) + 1;
            }
        });

        // Handle merged sections: Rollback groups and prepare spells for recreation
        const mergedSpells = Array.from(document.querySelectorAll('[data-be-spell-merge]'));
        const spellNamesToRecreate = [...new Set(mergedSpells.map(el => el.getAttribute('data-be-spell-merge')))];

        document.querySelectorAll('.be-merge-wrapper').forEach(wrapper => {
            const groupMergeId = wrapper.getAttribute('data-be-group-merge');
            if (groupMergeId) {
                const original = document.getElementById(groupMergeId);
                if (original) original.style.setProperty('display', '', 'important');
            }
            wrapper.remove();
        });

        // Recreate merged spells as floating sections
        for (const spellName of spellNamesToRecreate) {
            await createSpellDetailSection(spellName, { x: 0, y: 0 });
        }

        // Reposition all spell detail sections to the Y of their original spell label, at left: 1200px
        document.querySelectorAll('.print-section-container.be-spell-detail').forEach(detail => {
            const titleSpan = detail.querySelector('.print-section-header span');
            if (titleSpan) {
                const spellName = titleSpan.textContent.trim();
                // Find the original spell label in the DOM (searching for exact text match)
                const labels = Array.from(document.querySelectorAll('.ct-spells-spell__label'));
                const originalLabel = labels.find(l => l.textContent.trim() === spellName);
                
                if (originalLabel) {
                    const layoutRoot = document.getElementById('print-layout-wrapper');
                    const rootRect = layoutRoot.getBoundingClientRect();
                    const labelRect = originalLabel.getBoundingClientRect();
                    
                    // Calculate Y relative to the layout wrapper
                    const y = labelRect.top - rootRect.top;
                    detail.style.setProperty('left', `1200px`, 'important');
                    detail.style.setProperty('top', `${y}px`, 'important');
                    detail.style.setProperty('width', '300px', 'important');
                    detail.style.setProperty('height', 'auto', 'important');
                } else {
                    // Fallback: move to the right edge
                    detail.style.setProperty('left', `1200px`, 'important');
                    detail.style.setProperty('width', '300px', 'important');
                    detail.style.setProperty('height', 'auto', 'important');
                }
            }
        });

        // Rollback all OTHER extractions
        document.querySelectorAll('.print-section-container.be-extracted-section:not(.be-spell-detail)').forEach(section => {
            // Use rollbackSection logic but avoiding multiple feedbacks/bounds updates
            const originalId = section.dataset.originalId;
            const associatedIds = section.dataset.associatedIds ? JSON.parse(section.dataset.associatedIds) : [];
            const allIds = [originalId, ...associatedIds].filter(id => id);
            
            allIds.forEach(id => {
                const original = document.getElementById(id);
                if (original) {
                    original.style.setProperty('display', '', 'important');
                }
            });
            section.remove();
        });

        updateLayoutBounds();
        showFeedback('Layout reset to defaults!');
    } catch (err) {
        console.error('[DDB Print] Reset failed', err);
        alert('Failed to reset layout.');
    }
}

/**
 * Handles loading from file.
 */
function handleLoadFile() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const layout = JSON.parse(event.target.result);
                if (Storage.validateLayout(layout)) {
                    // Check version compatibility
                    if (layout.version !== Storage.SCHEMA_VERSION) {
                        alert(`Warning: The loaded layout version (${layout.version}) is older than the current version (${Storage.SCHEMA_VERSION}). Some newer features might not be present. It is recommended to save your layout again to upgrade the file.`);
                    }
                    await applyLayout(layout);
                    showFeedback('Layout loaded!');
                } else {
                    alert('Invalid layout file format.');
                }
            } catch (err) {
                console.error('[DDB Print] Load failed', err);
                alert('Failed to parse layout file.');
            }
        };
        reader.readAsText(file);
    };
    
    input.click();
}

/**
 * Handles restoring the layout from IndexedDB.
 */
async function restoreLayout() {
    try {
        await Storage.init();
        
        // Strategy: Load character-specific first, fallback to global
        const characterId = getCharacterId();
        let layout = null;
        
        if (characterId) {
            layout = await Storage.loadLayout(characterId);
        }
        
        if (!layout) {
            layout = await Storage.loadGlobalLayout();
        }

        if (layout && Storage.validateLayout(layout)) {
            console.log('[DDB Print] Restoring saved layout...');
            await applyLayout(layout);
            return true;
        }
    } catch (err) {
        console.error('[DDB Print] Restore failed', err);
    }
    return false;
}

/**
 * Shows a temporary feedback message.
 */
function showFeedback(msg) {
    const feedback = document.createElement('div');
    feedback.textContent = msg;
    feedback.style.position = 'fixed';
    feedback.style.top = '20px';
    feedback.style.left = '50%';
    feedback.style.transform = 'translateX(-50%)';
    feedback.style.backgroundColor = '#333';
    feedback.style.color = 'white';
    feedback.style.padding = '10px 20px';
    feedback.style.borderRadius = '5px';
    feedback.style.zIndex = '10001';
    feedback.style.boxShadow = '0 2px 10px rgba(0,0,0,0.5)';
    feedback.style.transition = 'opacity 0.5s';
    
    document.body.appendChild(feedback);
    
    setTimeout(() => {
        feedback.style.opacity = '0';
        setTimeout(() => feedback.remove(), 500);
    }, 2000);
}

/**
 * Shows a modal with layout data for manual copying.
 * @param {string} jsonData 
 */
function showFallbackModal(jsonData) {
    // Overlay
    const overlay = document.createElement('div');
    overlay.id = 'print-enhance-overlay';
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.backgroundColor = 'rgba(0,0,0,0.8)';
    overlay.style.zIndex = '20000';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.backdropFilter = 'blur(4px)';

    // Modal
    const modal = document.createElement('div');
    modal.style.backgroundColor = '#222';
    modal.style.color = 'white';
    modal.style.padding = '20px';
    modal.style.borderRadius = '12px';
    modal.style.width = '80%';
    modal.style.maxWidth = '600px';
    modal.style.display = 'flex';
    modal.style.flexDirection = 'column';
    modal.style.gap = '15px';
    modal.style.boxShadow = '0 10px 30px rgba(0,0,0,0.5)';
    modal.style.border = '1px solid #444';

    const title = document.createElement('h3');
    title.textContent = 'Layout JSON Data';
    title.style.margin = '0';
    modal.appendChild(title);

    const info = document.createElement('p');
    info.textContent = 'Copy the layout data below to save it manually.';
    info.style.fontSize = '14px';
    modal.appendChild(info);

    const textarea = document.createElement('textarea');
    textarea.value = jsonData;
    textarea.readOnly = true;
    textarea.style.height = '200px';
    textarea.style.backgroundColor = '#111';
    textarea.style.color = '#0f0';
    textarea.style.border = '1px solid #333';
    textarea.style.padding = '10px';
    textarea.style.fontFamily = 'monospace';
    textarea.style.borderRadius = '4px';
    modal.appendChild(textarea);

    const btnGroup = document.createElement('div');
    btnGroup.style.display = 'flex';
    btnGroup.style.justifyContent = 'flex-end';
    btnGroup.style.gap = '10px';

    const copyBtn = document.createElement('button');
    copyBtn.textContent = 'Copy to Clipboard';
    copyBtn.style.padding = '8px 16px';
    copyBtn.style.cursor = 'pointer';
    copyBtn.onclick = () => {
        textarea.select();
        document.execCommand('copy');
        copyBtn.textContent = 'Copied!';
        setTimeout(() => copyBtn.textContent = 'Copy to Clipboard', 2000);
    };
    btnGroup.appendChild(copyBtn);

    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'Close';
    closeBtn.style.padding = '8px 16px';
    closeBtn.style.cursor = 'pointer';
    closeBtn.onclick = () => overlay.remove();
    btnGroup.appendChild(closeBtn);

    modal.appendChild(btnGroup);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
}

/**
 * Scans the current DOM for layout information.
 * @returns {object} Layout data following the schema.
 */
/**
 * Scans the current DOM for layout information.
 * @returns {object} Layout data following the schema.
 */
async function scanLayout() {
    const layout = {
        version: Storage.SCHEMA_VERSION,
        sections: {},
        clones: [],
        extractions: [],
        spell_details: [],
        merges: [],
        spell_cache: []
    };

    // Include cached spells
    try {
        await Storage.init();
        layout.spell_cache = await Storage.getAllSpells();
    } catch (err) {
        console.error('[DDB Print] Could not scan spell cache', err);
    }

    // 1. Scan for standard sections and floating containers
    const sections = document.querySelectorAll('.print-section-container');
    sections.forEach(section => {
        const id = section.id;
        if (!id) return;

        const header = section.querySelector('.print-section-header span');
        const content = section.querySelector('.print-section-content');

        const getBorderStyle = (el) => {
            if (el.classList.contains('no-border')) return 'no-border';
            if (el.classList.contains('ability_border')) return 'ability_border';
            if (el.classList.contains('spikes_border')) return 'spikes_border';
            if (el.classList.contains('barbarian_border')) return 'barbarian_border';
            if (el.classList.contains('goth_border')) return 'goth_border';
            if (el.classList.contains('plants_border')) return 'plants_border';
            if (el.classList.contains('box_border')) return 'box_border';
            if (el.classList.contains('default-border')) return 'default-border';
            return null;
        };

        if (section.classList.contains('be-clone')) {
            const sanitizedHtml = content ? getSanitizedContent(content).innerHTML : '';
            layout.clones.push({
                id: id,
                title: header ? header.textContent.trim() : 'Clone',
                html: sanitizedHtml,
                left: section.style.left,
                top: section.style.top,
                width: section.style.width,
                height: section.style.height,
                zIndex: section.style.zIndex || '10',
                minimized: section.dataset.minimized === 'true',
                compact: section.classList.contains('be-compact-mode'),
                borderStyle: getBorderStyle(section)
            });
            return;
        }

        if (section.classList.contains('be-spell-detail')) {
            layout.spell_details.push({
                id: id,
                spellName: header ? header.textContent.trim() : 'Spell',
                left: section.style.left,
                top: section.style.top,
                width: section.style.width,
                height: section.style.height,
                zIndex: section.style.zIndex || '10',
                minimized: section.dataset.minimized === 'true',
                borderStyle: getBorderStyle(section)
            });
            return;
        }

        if (section.classList.contains('be-extracted-section')) {
            const originalId = section.dataset.originalId;
            const original = document.getElementById(originalId);
            
            const extractionData = {
                id: id,
                originalId: originalId,
                parentSectionId: section.dataset.parentSectionId,
                title: header ? header.textContent.trim() : 'Extracted',
                left: section.style.left,
                top: section.style.top,
                width: section.style.width,
                height: section.style.height,
                zIndex: section.style.zIndex || '10',
                minimized: section.dataset.minimized === 'true',
                compact: section.classList.contains('be-compact-mode'),
                borderStyle: getBorderStyle(section)
            };

            if (original) {
                const resolution = getExtractionSelector(original, true);
                if (resolution) {
                    extractionData.selector = resolution.selector;
                    extractionData.index = resolution.index;
                }
            }

            layout.extractions.push(extractionData);
            return;
        }

        layout.sections[id] = {
            left: section.style.left,
            top: section.style.top,
            width: section.style.width,
            height: section.style.height,
            zIndex: section.style.zIndex || '10',
            minimized: section.dataset.minimized === 'true',
            compact: section.classList.contains('be-compact-mode'),
            borderStyle: getBorderStyle(section),
            innerWidths: {}
        };

        const innerContainers = section.querySelectorAll('div[class$="-row-header"], div[class$="-content"]');
        innerContainers.forEach((container, cIdx) => {
            Array.from(container.children).forEach((child, dIdx) => {
                if (child.tagName === 'DIV' && child.style.width) {
                    const key = `${cIdx}-${dIdx}`;
                    layout.sections[id].innerWidths[key] = child.style.width;
                }
            });
        });
    });

    // 2. Scan for Merges (systematic approach using stored attributes)
    document.querySelectorAll('.be-merge-wrapper').forEach(wrapper => {
        const groupId = wrapper.getAttribute('data-be-group-merge');
        const spellMergeChild = wrapper.querySelector('[data-be-spell-merge]');
        const spellName = spellMergeChild ? spellMergeChild.getAttribute('data-be-spell-merge') : null;

        if (!groupId && !spellName) return;

        // Retrieve target metadata stored during merge
        const targetType = wrapper.getAttribute('data-be-target-type');
        const targetId = wrapper.getAttribute('data-be-target-id');
        const targetSelector = wrapper.getAttribute('data-be-target-selector');
        const targetIndex = wrapper.getAttribute('data-be-target-index');
        const targetName = wrapper.getAttribute('data-be-target-name');

        if (!targetType) return;

        const mergeEntry = {
            source: spellName ? { type: 'spell', spellName } : { type: 'group', originalId: groupId },
            target: {
                type: targetType,
                id: targetId,
                selector: targetSelector,
                index: targetIndex !== null ? parseInt(targetIndex) : undefined,
                name: targetName
            }
        };

        // Source details for groups
        if (mergeEntry.source.type === 'group') {
            const orig = document.getElementById(groupId);
            if (orig) {
                const res = getExtractionSelector(orig, true);
                if (res) {
                    mergeEntry.source.selector = res.selector;
                    mergeEntry.source.index = res.index;
                    mergeEntry.source.title = findSectionTitle(orig) || 'Merged Content';
                }
            }
        }

        layout.merges.push(mergeEntry);
    });

    return layout;
}


/**
 * Migrates layout data from older versions to the current schema.
 * @param {object} data 
 * @returns {object} Migrated data.
 */
function migrateLayout(data) {
    if (!data || typeof data !== 'object') return data;
    
    // Initialize merges array if missing
    if (!data.merges) data.merges = [];

    // Helper to extract merges from legacy associatedExtractions
    const extractLegacyMerges = (containerId, associated) => {
        if (!Array.isArray(associated)) return;
        associated.forEach(aEx => {
            // Avoid duplicates if already migrated
            const exists = data.merges.some(m => 
                m.target.id === containerId && 
                (m.source.originalId === aEx.originalId || m.source.spellName === aEx.spellName)
            );
            if (exists) return;

            data.merges.push({
                source: aEx, // Structure matches (type, originalId, spellName, etc)
                target: {
                    type: 'section',
                    id: containerId
                }
            });
        });
    };

    // Scan extractions
    if (data.extractions) {
        data.extractions.forEach(ex => {
            if (ex.associatedExtractions) {
                extractLegacyMerges(ex.id, ex.associatedExtractions);
                delete ex.associatedExtractions;
            }
        });
    }

    // Scan clones
    if (data.clones) {
        data.clones.forEach(cl => {
            if (cl.associatedExtractions) {
                extractLegacyMerges(cl.id, cl.associatedExtractions);
                delete cl.associatedExtractions;
            }
        });
    }

    // Scan standard sections
    if (data.sections) {
        Object.entries(data.sections).forEach(([id, sect]) => {
            if (sect.associatedExtractions) {
                extractLegacyMerges(id, sect.associatedExtractions);
                delete sect.associatedExtractions;
            }
        });
    }
    
    return data;
}

/**
 * Applies layout information to the current DOM.
 * @param {object} layout 
 */
async function applyLayout(layout) {
    layout = migrateLayout(layout);
    if (!layout || !layout.sections) return;

    // 0. Ensure elements are flagged (crucial for selector-based restoration)
    flagExtractableElements();

    // Save spells to cache if present
    if (layout.spell_cache && Array.isArray(layout.spell_cache)) {
        try {
            await Storage.init();
            await Storage.saveSpells(layout.spell_cache);
        } catch (err) {
            console.error('[DDB Print] Could not restore spell cache', err);
        }
    }

    // Remove existing clones to avoid duplicates on re-apply
    document.querySelectorAll('.print-section-container.be-clone').forEach(el => el.remove());
    // Remove existing extractions to avoid duplicates
    document.querySelectorAll('.print-section-container.be-extracted-section').forEach(el => {
        const originalId = el.dataset.originalId;
        const original = document.getElementById(originalId);
        if (original) original.style.display = '';
        el.remove();
    });

    // Restore clones
    if (layout.clones && Array.isArray(layout.clones)) {
        layout.clones.forEach(cloneData => {
            renderClonedSection(cloneData);
        });
    }

    // Restore extractions
    if (layout.extractions && Array.isArray(layout.extractions)) {
        const deferredExtractions = [];
        layout.extractions.forEach(exData => {
            const success = renderExtractedSection(exData);
            if (!success) deferredExtractions.push(exData);
        });

        // Retry deferred extractions once after a delay (React lazy-load buffer)
        if (deferredExtractions.length > 0) {
            setTimeout(() => {
                // Re-flag elements just in case new ones appeared
                flagExtractableElements();
                deferredExtractions.forEach(exData => {
                    renderExtractedSection(exData);
                });
            }, 1000);
        }
    }

    // Restore spell details
    if (layout.spell_details && Array.isArray(layout.spell_details)) {
        layout.spell_details.forEach(spellData => {
            const container = createSpellDetailSection(spellData.spellName, null, spellData);
            if (container && spellData.borderStyle) {
                container.classList.add(spellData.borderStyle);
            }
        });
    }

    for (const [id, styles] of Object.entries(layout.sections)) {
        const section = document.getElementById(id);
        if (!section) continue;

        // Apply border style
        clearBorderStyles(section);
        if (styles.borderStyle) {
            section.classList.add(styles.borderStyle);
        }

        // Apply main styles
        if (styles.left) section.style.left = styles.left;
        if (styles.top) section.style.top = styles.top;
        if (styles.width) section.style.width = styles.width;
        if (styles.height) section.style.height = styles.height;
        if (styles.zIndex) section.style.zIndex = styles.zIndex;

        // Handle minimization
        if (styles.minimized) {
            section.dataset.minimized = 'true';
            const content = section.querySelector('.print-section-content');
            if (content) content.style.display = 'none';
        } else {
            section.dataset.minimized = 'false';
            const content = section.querySelector('.print-section-content');
            if (content) content.style.display = 'flex';
        }

        // Handle compact mode restoration
        if (styles.compact) {
            section.classList.add('be-compact-mode');
            const btn = section.querySelector('.be-compact-button');
            if (btn) btn.style.backgroundColor = 'var(--btn-color)';
        } else {
            section.classList.remove('be-compact-mode');
            const btn = section.querySelector('.be-compact-button');
            if (btn) btn.style.backgroundColor = 'var(--btn-color-highlight)';
        }

        // Apply inner widths
        if (styles.innerWidths) {
            const innerContainers = section.querySelectorAll('div[class$="-row-header"], div[class$="-content"]');
            for (const [key, width] of Object.entries(styles.innerWidths)) {
                const [cIdx, dIdx] = key.split('-').map(Number);
                const container = innerContainers[cIdx];
                if (container) {
                    const child = container.children[dIdx];
                    if (child && child.tagName === 'DIV') {
                        child.style.width = width;
                        child.style.minWidth = width;
                    }
                }
            }
        }
    }

    // 5. Restore Systematic Merges
    if (layout.merges && Array.isArray(layout.merges)) {
        for (const merge of layout.merges) {
            try {
                let sourceContainer = null;
                
                // 5.1 Resolve or Create Source
                if (merge.source.type === 'spell') {
                    sourceContainer = await createSpellDetailSection(merge.source.spellName, { x: 0, y: 0 });
                } else if (merge.source.type === 'group') {
                    // Re-extract the group
                    let original = document.getElementById(merge.source.originalId);
                    if (!original && merge.source.selector) {
                        const matches = document.querySelectorAll(merge.source.selector);
                        original = matches[merge.source.index];
                        if (original) original.id = merge.source.originalId;
                    }
                    if (original) {
                        sourceContainer = await handleElementExtraction(original);
                    }
                }

                if (!sourceContainer) continue;

                // 5.2 Resolve Target
                let targetInfo = null;
                if (merge.target.type === 'section') {
                    const tEl = document.getElementById(merge.target.id);
                    if (tEl) {
                        targetInfo = {
                            type: 'section',
                            id: merge.target.id,
                            element: tEl,
                            name: merge.target.id
                        };
                    }
                } else if (merge.target.type === 'sheet') {
                    let tEl = document.getElementById(merge.target.id);
                    if (!tEl && merge.target.selector) {
                        const matches = document.querySelectorAll(merge.target.selector);
                        tEl = matches[merge.target.index];
                    }
                    if (tEl) {
                        targetInfo = {
                            type: 'sheet',
                            id: merge.target.id,
                            element: tEl,
                            name: merge.target.name || 'Sheet Target'
                        };
                    }
                }

                // 5.3 Execute Merge
                if (targetInfo && sourceContainer) {
                    // console.log(`[DDB Print] Restoring merge: ${sourceContainer.id} -> ${targetInfo.name || targetInfo.id}`);
                    handleMergeSections(sourceContainer, targetInfo);
                } else {
                    console.warn('[DDB Print] Could not resolve merge target or source', merge.target, !!sourceContainer);
                }
            } catch (err) {
                console.error('[DDB Print] Failed to process merge', merge, err);
            }
        }
    }

    updateLayoutBounds();
}

/**
 * Draws visual page separators to indicate print boundaries.
 * Scales the "page height" based on how much the content needs to shrink to fit 8.5in width.
 */
function drawPageSeparators(totalHeight, totalWidth) {
    const container = document.getElementById('print-layout-wrapper');
    if (!container) return;

    // Remove existing separators
    container.querySelectorAll('.print-page-separator').forEach(el => el.remove());

    // Constants for Letter Portrait at 96 DPI
    // Standard Letter is 8.5in x 11in.
    // However, most browsers apply margins (approx 0.4-0.5in).
    // Printable Area ≈ 8in x 10in.
    // Width: 8in * 96 = 768px (safe area)
    // Height: 10in * 96 = 960px (safe area)
    const PAGE_WIDTH_PX = 816; // 8.5in full width for scaling calc
    const PAGE_HEIGHT_PX = 960; // 10in height (excludes ~0.5in margins top/bottom)

    // Calculate effective page height if scaled to fit
    // If content is wider than 816px, the browser shrinks it.
    // Scale Factor = 816 / totalWidth (e.g. 0.68)
    // Effective Pixel Height = 1056 / Scale Factor
    // Example: 1200px wide content. Scale = 0.68.
    // Effective Height = 1056 / 0.68 = 1552px.
    
    // Default scale is 1 if content fits or is smaller
    let effectivePageHeight = PAGE_HEIGHT_PX;
    let scaleLabel = "100%";
    
    if (totalWidth > PAGE_WIDTH_PX) {
        const scale = PAGE_WIDTH_PX / totalWidth;
        effectivePageHeight = PAGE_HEIGHT_PX / scale;
        scaleLabel = `${Math.round(scale * 100)}%`;
    }

    console.log(`[DDB Print] Separators: Content Width ${totalWidth}px. Scale ${scaleLabel}. Page Height ${Math.round(effectivePageHeight)}px`);

    let currentY = effectivePageHeight;
    let pageNum = 1;
    
    while (currentY < totalHeight) {
        const separator = document.createElement('div');
        separator.className = 'print-page-separator';
        separator.style.position = 'absolute';
        separator.style.left = '0';
        separator.style.top = `${currentY}px`;
        separator.style.width = `${totalWidth}px`;
        separator.style.height = '2px';
        separator.style.borderTop = '2px dashed red';
        separator.style.zIndex = '99995'; 
        separator.style.pointerEvents = 'none';
        separator.style.opacity = '0.5';
        
        // Label
        const label = document.createElement('span');
        label.textContent = `Page ${pageNum} END (Scale: ${scaleLabel})`;
        label.style.position = 'absolute';
        label.style.right = '5px';
        label.style.top = '-15px';
        label.style.color = 'red';
        label.style.fontSize = '12px';
        label.style.fontWeight = 'bold';
        label.style.backgroundColor = 'rgba(255,255,255,0.8)';
        
        separator.appendChild(label);
        container.appendChild(separator);
        
        currentY += effectivePageHeight;
        pageNum++;
    }
}


/**
 * Gets or creates a container for section-level action buttons (Clone, Compact, Append, Delete).
 * @param {HTMLElement} section The section element.
 * @returns {HTMLElement} The container element.
 */
function getOrCreateActionContainer(section) {
    let container = section.querySelector('.be-section-actions');
    if (!container) {
        container = document.createElement('div');
        container.className = 'be-section-actions';
        section.appendChild(container);
    }
    return container;
}

/**
 * Injects clone buttons and compact toggles into sections.
 */
function injectCloneButtons(context = document) {
    const s = window.DomManager.getInstance().selectors;
    const selector = `${s.UI.SUBSECTION}, ${s.UI.SECTION}, .print-section-container`;
    // If the context itself matches the selector, include it
    const elements = Array.from(context.querySelectorAll(selector));
    if (context instanceof HTMLElement && context.matches(selector)) {
        elements.push(context);
    }

    elements.forEach(section => {
        const actionContainer = getOrCreateActionContainer(section);

        // 1. Clone Button
        if (!actionContainer.querySelector('.be-clone-button')) {
            const btn = document.createElement('button');
            btn.className = 'be-clone-button';
            btn.innerHTML = '📋'; // Clipboard icon
            btn.title = 'Clone Section';
            
            btn.onclick = async (e) => {
                e.stopPropagation();
                const id = section.id || 'unknown';
                
                // Get section name for default title
                const header = section.querySelector(`${s.CORE.SUBSECTION_HEADER}, ${s.CORE.SECTION_HEADER}, .print-section-header span`);
                const sectionName = header ? header.textContent.trim() : 'Section';
                
                const title = await showInputModal('Clone Section', `Enter a name for this ${sectionName} clone:`, `${sectionName} (Clone)`);
                
                if (title) {
                    const snapshot = captureSectionSnapshot(id);
                    if (snapshot) {
                        snapshot.id = `clone-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
                        snapshot.title = title;
                        
                        const clone = renderClonedSection(snapshot);
                        if (clone) {
                            showFeedback(`Cloned: ${title}`);
                            updateLayoutBounds();
                            // Re-run injection to ensure new clone gets buttons
                            injectCloneButtons(); 
                            injectSpellDetailTriggers(clone);
                        }
                    } else {
                        showFeedback('Failed to capture snapshot.');
                    }
                }
            };
            actionContainer.appendChild(btn);
        }

        // 2. Compact Mode Button
        const sourceId = section.dataset.originalId || section.id || '';
        const isNumbered = /^section-Section-\d+$/.test(sourceId);
        
        if (sourceId && !isNumbered && !actionContainer.querySelector('.be-compact-button')) {
            const compactBtn = document.createElement('button');
            compactBtn.className = 'be-compact-button';
            compactBtn.innerHTML = '📏'; 
            compactBtn.title = 'Toggle Compact Mode';
            
            compactBtn.onclick = (e) => {
                e.stopPropagation();
                const isCompact = section.classList.toggle('be-compact-mode');
                
                if (isCompact) {
                    compactBtn.style.backgroundColor = 'var(--btn-color)';
                } else {
                    compactBtn.style.backgroundColor = 'var(--btn-color-highlight)';
                }
                
                updateLayoutBounds();
            };

            actionContainer.appendChild(compactBtn);
        }

        // 3. Border Style Button
        if (!actionContainer.querySelector('.be-border-button')) {
            const borderBtn = document.createElement('button');
            borderBtn.className = 'be-border-button';
            borderBtn.innerHTML = '🖼️'; 
            borderBtn.title = 'Select Border Style';
            
            borderBtn.onclick = async (e) => {
                e.stopPropagation();
                
                // Determine current style
                const currentStyle = ALL_BORDER_STYLES.find(s => section.classList.contains(s)) || 'default-border';
                
                const result = await showBorderPickerModal(currentStyle);
                
                if (result) {
                    clearBorderStyles(section);
                    section.classList.add(result.style);
                    
                    updateLayoutBounds();
                }
            };

            actionContainer.appendChild(borderBtn);
        }
    });
}

/**
 * Injects CSS for Compact Mode.
 */
function injectCompactStyles() {
    if (document.getElementById('ddb-print-compact-style')) return;

    const s = window.DomManager.getInstance().selectors;
    
    // Ensure all keys exist to prevent template error if fallback was partial
    const c = s.COMPACT; 

    const style = document.createElement('style');
    style.id = 'ddb-print-compact-style';
    style.textContent = `
        .print-section-container.be-compact-mode {
            --reduce-height-by: 0px;
            --reduce-width-by: 0px;
        }
        .print-section-container.be-compact-mode ${c.TABLE_HEADER},
        .print-section-container.be-compact-mode ${c.GENERIC_HEADER},
         {
            margin-top: 10px !important;
            margin-bottom: 5px !important;
            padding-bottom: 2px !important;
            border-bottom: 1px solid #ccc !important;
        }
        .print-section-container.be-compact-mode ${c.GENERIC_HEADING} {
            margin: 0px !important;
        }
        .print-section-container.be-compact-mode ${c.GENERIC_ROW} {
            padding: 2px 0px !important;
        }
        .print-section-container.be-compact-mode ${c.ROW_HEADER} ${c.PRIMARY},
        .print-section-container.be-compact-mode ${c.GENERIC_ROW} ${c.ROW_PRIMARY} {
            max-width: 80px !important;
        }
        .print-section-container.be-compact-mode ${c.GENERIC_CONTENT} > div {
            padding: 0 !important;
            min-height: auto !important;
            border-bottom: 1px dashed #eee !important;
        }
        
        /* Hide or shrink icons */
        .print-section-container.be-compact-mode ${c.ICON_ATTACK},
        .print-section-container.be-compact-mode ${c.ICON_RANGE},
        .print-section-container.be-compact-mode ${c.ICON_CAST_TIME},
        .print-section-container.be-compact-mode ${c.ICON_ATTACK},
        .print-section-container.be-compact-mode ${c.ICON_DAMAGE}{
            transform: scale(0.8);
            margin: 0 !important;
        }
        
        .print-section-container.be-compact-mode ${c.ICON_FILE} {
            width: 16px !important;
            height: 16px !important;
        }
        
        /* Hide previews for extras */
        .print-section-container.be-compact-mode ${s.EXTRAS.CONTAINER} ${c.PREVIEW},
        .print-section-container.be-compact-mode ${s.EXTRAS.CONTAINER} ${c.PREVIEW_ALT} {
            display: none !important;
        }

        /* Tighten text */
        .print-section-container.be-compact-mode ${c.LABEL},
        .print-section-container.be-compact-mode ${c.GENERIC_HEADER},
        .print-section-container.be-compact-mode ${c.NOTES} {
            font-size: 11px !important;
            line-height: 1.2 !important;
        }
        
        .print-section-container.be-compact-mode ${c.ACTIVATION},
        .print-section-container.be-compact-mode ${c.RANGE},
        .print-section-container.be-compact-mode ${c.HIT_DC},
        .print-section-container.be-compact-mode ${c.EFFECT} {
            font-size: 11px !important;
            padding: 0 2px !important;
            vertical-align: middle !important;
        }

        /* Buttons (Cast, At Will, etc) */
        .print-section-container.be-compact-mode ${c.BUTTON_CONTAINER},
        .print-section-container.be-compact-mode ${s.CORE.BUTTON} {
            height: 20px !important;
            line-height: 20px !important;
            padding: 0!important;
            font-size: 10px !important;
            min-height: 0 !important;
        }

        /* Slots Checkboxes - Align to immediate left of "SLOTS" label if possible, or just left align container */
        .print-section-container.be-compact-mode ${c.SLOTS} {
            margin-left: 10px !important;
            margin-right: auto !important; /* Push to left */
            transform: scale(0.9);
            transform-origin: left center;
        }
        
        .print-section-container.be-compact-mode ${c.HEADER_CONTENT} {
            flex: 0 0 auto !important; /* Stop taking full width */
            margin-right: 10px !important;
        }
        
        .print-section-container.be-compact-mode ${c.GENERIC_HEADER} {
            justify-content: flex-start !important; /* Align content to start */
        }

        /* General width reductions for columns */
        .print-section-container.be-compact-mode ${c.ACTION},
        .print-section-container.be-compact-mode ${c.DISTANCE},
        .print-section-container.be-compact-mode ${c.META} {
            width: auto !important;
            max-width: none !important;
        }

        /* Spell Details Trigger Button */
        ${s.SPELLS.ROW} {
            position: relative;
        }
        .be-spell-details-button {
            position: absolute;
            right: 10px;
            top: 50%;
            transform: translateY(-50%);
            display: none;
            background: #242528;
            color: white;
            border: 1px solid #444;
            border-radius: 4px;
            padding: 2px 8px;
            font-size: 11px;
            cursor: pointer;
            z-index: 100;
            box-shadow: 0 2px 5px rgba(0,0,0,0.5);
        }
        ${s.SPELLS.ROW}:hover .be-spell-details-button {
            display: block;
        }
        .be-spell-details-button:hover {
            background: #333;
            border-color: #666;
        }

        /* Loading Spinner */
        .be-spinner {
            border: 4px solid rgba(255, 255, 255, 0.1);
            width: 36px;
            height: 36px;
            border-radius: 50%;
            border-left-color: #EC2127;
            animation: be-spin 1s linear infinite;
            margin: 20px auto;
        }
        @keyframes be-spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }

        /* Error UI Buttons */
        .be-error-actions {
            display: flex;
            gap: 10px;
            margin-top: 10px;
            justify-content: center;
        }
        .be-retry-button { background: #4CAF50 !important; color: white !important; }
        .be-delete-button { background: #f44336 !important; color: white !important; }

        /* Dynamic Extraction Trigger */
        .be-extractable {
            transition: outline 0.1s ease-in-out;
            margin: 2px;
        }
        .be-extractable:hover {
            outline: 2px dashed black !important;
            position: relative;
        }
        .be-extractable:hover:before {
            content: "Extract content with double click";
            position: absolute;
            top: -25px;
            left: 0;
            background: black;
            color: white;
            padding: 2px 8px;
            font-size: 12px;
            border-radius: 4px;
            white-space: nowrap;
            z-index: 10001;
            pointer-events: none;
            box-shadow: 0 2px 5px rgba(0,0,0,0.5);
        }
    `;
    document.head.appendChild(style);
}

    // Expose for testing synchronously

    window.createDraggableContainer = createDraggableContainer;
    window.extractAndWrapSections = extractAndWrapSections;
    window.injectClonesIntoSpellsView = injectClonesIntoSpellsView;
    window.initDragAndDrop = initDragAndDrop;
    window.enforceFullHeight = enforceFullHeight;
    window.removeSearchBoxes = removeSearchBoxes;
    window.tweakStyles = tweakStyles;
    window.injectCompactStyles = injectCompactStyles;
    window.moveDefenses = moveDefenses;
    window.movePortrait = movePortrait;
    window.initResponsiveScaling = initResponsiveScaling;
    window.initZIndexManagement = initZIndexManagement;
    window.autoArrangeSections = autoArrangeSections;
    window.initResizeLogic = initResizeLogic;
    window.updateLayoutBounds = updateLayoutBounds;
    window.removeSpecificSvgs = removeSpecificSvgs;
    window.drawPageSeparators = drawPageSeparators;
    window.moveQuickInfo = moveQuickInfo;
    window.suppressResizeEvents = suppressResizeEvents;
    window.separateAbilities = separateAbilities;
    window.separateQuickInfoBoxes = separateQuickInfoBoxes;
    window.adjustInnerContentWidth = adjustInnerContentWidth;
    window.scanLayout = scanLayout;
    window.applyLayout = applyLayout;
    window.applyDefaultLayout = applyDefaultLayout;
    window.handleSaveBrowser = handleSaveBrowser;
    window.handleLoadDefault = handleLoadDefault;
    window.handleSavePC = handleSavePC;
    window.handleLoadFile = handleLoadFile;
    window.restoreLayout = restoreLayout;
    window.showFeedback = showFeedback;
    window.createControls = createControls;
    window.showFallbackModal = showFallbackModal;
    window.showInputModal = showInputModal;
    window.showBorderPickerModal = showBorderPickerModal;
    window.showShapePickerModal = showShapePickerModal;
    window.handleManageClones = handleManageClones;
    window.captureSectionSnapshot = captureSectionSnapshot;
    window.renderClonedSection = renderClonedSection;
    window.createShape = createShape;
    window.applyShapeAsset = applyShapeAsset;
    window.Storage = Storage;
    window.injectCloneButtons = injectCloneButtons;
    window.injectSpellDetailTriggers = injectSpellDetailTriggers;
    window.flagExtractableElements = flagExtractableElements;
    window.findSectionTitle = findSectionTitle;
    window.createSpellDetailSection = createSpellDetailSection;
    window.injectAppendButton = injectAppendButton;
    window.getMergeTargets = getMergeTargets;
    window.handleMergeSections = handleMergeSections;
    window.handleElementExtraction = handleElementExtraction;
    window.rollbackSection = rollbackSection;
    window.getCharacterId = getCharacterId;
    window.fetchSpellWithCache = fetchSpellWithCache;
    window.getCharacterSpells = getCharacterSpells;

// Execution
(async () => {
    if (window.__DDB_TEST_MODE__) return;
    
    // Stabilize layout by suppressing global resize events
    suppressResizeEvents();
    
    // Idempotency: cleanup previous run if exists
    const existingWrapper = document.getElementById('print-layout-wrapper');
    if (existingWrapper) {
        // User Request: Confirmation for re-run
        if (confirm('You need to reload to apply changes again, are you sure?')) {
            window.location.reload();
            return;
        } else {
            return; // Do nothing
        }
    }

    enforceFullHeight();
    await injectClonesIntoSpellsView();
    moveDefenses();
    tweakStyles();
    injectCompactStyles();
    removeSearchBoxes();
    movePortrait(); // User Request: Move portrait at the end
    moveQuickInfo(); // User Request: Make Quick Info draggable
    separateAbilities();
    separateQuickInfoBoxes();
    injectCloneButtons();
    flagExtractableElements();
    initDragAndDrop();
    initResponsiveScaling();
    initZIndexManagement();
    initResizeLogic();
    
    // UI Controls
    createControls();
    
    let layoutRestored = false;
    layoutRestored = await restoreLayout();
    if (layoutRestored) updateLayoutBounds();
    
    if (!layoutRestored) {
        applyDefaultLayout();
    }
})();
})();
