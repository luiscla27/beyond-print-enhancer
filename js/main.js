/*
Licensed under Blue Oak Model License 1.0.0
*/

(function () {

/**
 * Storage management for D&D Beyond Print Enhancer.
 * Uses IndexedDB to persist layout configurations and custom data.
 */
const DB_NAME = 'DDBPrintEnhancerDB';
const DB_VERSION = 1;
const STORE_NAME = 'layouts';
const SCHEMA_VERSION = '1.0.0';

const DEFAULT_LAYOUTS = {
    'section-Quick-Info': { left: '0px', top: '0px', width: '1200px', height: '144px' },
    'section-Section-1': { left: '0px', top: '160px', width: '256px', height: '176px' },
    'section-Section-2': { left: '0px', top: '352px', width: '256px', height: '176px' },
    'section-Section-3': { left: '0px', top: '544px', width: '256px', height: '208px' },
    'section-Section-4': { left: '272px', top: '160px', width: '208px', height: '592px' },
    'section-Section-5': { left: '496px', top: '160px', width: '528px', height: '160px' },
    'section-Section-6': { left: '1040px', top: '160px', width: '160px', height: '160px' },
    'section-Actions':   { left: '496px', top: '336px', width: '704px', height: '1360px' },
    'section-Notes':   { left: '0px', top: '768px', width: '480px', height: '928px' },
    'section-Features_&_Traits':   { left: '0px', top: '1712px', width: '480px', height: '1984px' },
    'section-Spells':   { left: '496px', top: '1712px', width: '704px', height: '816px' },
    'section-Extras':   { left: '0px', top: '3712px', width: '480px', height: '1936px' },
    'section-Background':   { left: '496px', top: '2544px', width: '704px', height: '1152px' },
    'section-Inventory':   { left: '496px', top: '3712px', width: '704px', height: '1936px' }
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
  }
};

/**
 * Robust query selector that tries multiple patterns and handles obfuscated classes.
 */
function safeQuery(selectors, context = document) {
  if (!Array.isArray(selectors)) selectors = [selectors];
  
  for (const selector of selectors) {
    try {
      const element = context.querySelector(selector);
      if (element) return element;
    } catch (err) { // eslint-disable-line no-unused-vars
      // Skip invalid selectors
    }
  }
  return null;
}

/**
 * Robust query selector for multiple elements.
 */
function safeQueryAll(selectors, context = document) {
  if (!Array.isArray(selectors)) selectors = [selectors];
  
  for (const selector of selectors) {
    try {
      const elements = context.querySelectorAll(selector);
      if (elements.length > 0) return Array.from(elements);
    } catch (err) { // eslint-disable-line no-unused-vars
      // Skip invalid selectors
    }
  }
  return [];
}

/**
 * Finds an element by its text content and optional selector.
 */
function findByText(text, selector = '*') {
  const elements = document.querySelectorAll(selector);
  return Array.from(elements).find(el => {
    // Check if the element itself OR any child (like a label inside a button) matches the text
    const exactMatch = el.textContent.trim().toLowerCase() === text.toLowerCase();
    // For navigation, we usually want elements that DON'T have many children to avoid containers
    return exactMatch && el.children.length < 3; 
  });
}

/**
 * Finds an element whose class name contains a specific pattern.
 */
function findByClassPattern(pattern, tagName = '*') {
  const elements = document.querySelectorAll(tagName);
  return Array.from(elements).find(el => el.className.includes(pattern));
}

/**
 * Navigate to a specific character sheet section (tab).
 */
function navToSection(name) {
  // Strategy 1: Look for obfuscated tab button class
  const tabs = safeQueryAll('button[class*="tabButton"]');
  let target = tabs.find(tab => tab.textContent.toLowerCase().includes(name.toLowerCase()));
  
  // Strategy 2: Look for ANY button/link/div with the exact text
  if (!target) {
    target = findByText(name, 'button') || findByText(name, 'a') || findByText(name, 'div') || findByText(name, 'span');
  }

  // Strategy 3: Loose text search on all buttons
  if (!target) {
    const allButtons = Array.from(document.querySelectorAll('button, [role="button"]'));
    target = allButtons.find(btn => btn.textContent.toLowerCase().includes(name.toLowerCase()));
  }

  if (target) {
    // If we found a label or span, click the actual interactive element
    const clickTarget = (target.tagName === 'BUTTON' || target.tagName === 'A') ? target : target.closest('button, a, [role="button"]');
    if (clickTarget) {
        console.log(`[DDB Print Enhance] Navigating to: ${name}`);
        clickTarget.click();
        return target;
    }
  }
  
  console.error(`[DDB Print Enhance] Could not find tab for section: ${name}`);
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

  header.setAttribute('draggable', 'true'); // Added here instead
  
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
  // Strategy: Identify sections by looking for tab buttons
  let tabs = Array.from(document.querySelectorAll('button[class*="tabButton"]'));
  // Fallback: manual list if detection fails
  if (tabs.length === 0) {
      console.warn('[DDB Print] No tabs found automatically, using default list.');
      const defaultSections = ['Actions', 'Spells', 'Inventory', 'Features', 'Traits', 'Description', 'Notes', 'Extras'];
      // We'll map these to dummy objects to mimic the tab structure for the loop
      tabs = defaultSections.map(s => ({ textContent: s }));
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

    if (target || tabs.length > 0) { // Proceed if navigation worked or we're just trying
        // Priority: Find the main structural container that holds the styles
        // We need to handle cases where multiple exist (some hidden)
        const selectors = [
            '[class*="styles_primaryBox"]',
            '.ct-primary-box', 
            '.ddbc-box-background + div section',
            '.sheet-body section'
        ];
        
        // Helper to find visible element among matches
        let content = null;
        for (const selector of selectors) {
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
            if (section.name === 'Spells' || section.title === 'Spells' || section.testId === 'SPELLS') {
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
            // We exclude the one we just hid to avoid conflicting logic, though display:none wins.
            const bgSvgs = clone.querySelectorAll('.ct-primary-box > svg, svg.ddbc-rep-box-background__svg, .ddbc-box-background:not([style*="display: none"]) svg');
            bgSvgs.forEach(svg => {
                svg.style.height = '100%';
                svg.style.width = '100%';
                if(svg.hasAttribute('height')) svg.removeAttribute('height');
                if(svg.hasAttribute('width')) svg.removeAttribute('width');
                svg.setAttribute('preserveAspectRatio', 'none');
            });
            
            // Explicitly fix Group Boxes (Proficiency, Skills, Senses, Saving Throws)
            // Keeping this logic for now as it targets specific UI elements that might need to be visible,
            // unless the user wants *those* borders gone too. Assuming "all svg borders" means the main container ones first.
            const groupBoxSvgs = clone.querySelectorAll('.ct-proficiency-groups-box svg, .ct-senses-box svg, .ct-skills-box svg, .ct-saving-throws-box svg');
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
    if (!container) return;

    // 1. Remove first .ddbc-box-background
    const firstBg = container.querySelector('.ddbc-box-background');
    if (firstBg) {
        // User Request: Don't hide the background if it belongs to Armor Class or Initiative
        const isProtected = firstBg.querySelector('.ddbc-armor-class-box-svg, .ddbc-initiative-box-svg') ||
                            firstBg.closest('.ddbc-armor-class-box, .ddbc-initiative-box');
        
        if (!isProtected) {
            firstBg.style.display = 'none';
        }
    }

    // 2. Remove all section > div > svg
    // Check nested instances
    // User Request: Exclude .ddbc-armor-class-box-svg and .ddbc-initiative-box-svg
    container.querySelectorAll('section > div > svg').forEach(svg => {
        if (!svg.classList.contains('ddbc-armor-class-box-svg') && !svg.classList.contains('ddbc-initiative-box-svg')) {
            svg.style.display = 'none';
        }
    });
    
    // Check if container itself matches section > div > svg pattern (e.g. if container is section)
    if (container.tagName === 'SECTION') {
        container.querySelectorAll(':scope > div > svg').forEach(svg => {
            if (!svg.classList.contains('ddbc-armor-class-box-svg') && !svg.classList.contains('ddbc-initiative-box-svg')) {
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
    const svgs = document.querySelectorAll('svg');
    svgs.forEach(svg => {
        if (svg.querySelector('defs, symbol') || svg.style.display === 'none') {
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
 * Injects extracted clones into the live Spells view to create the print layout.
 */
async function injectClonesIntoSpellsView() {
  const containers = await extractAndWrapSections();

  // 1. Navigate to Spells to make it the active, visible view
  await navToSection('Spells');
  await new Promise(r => setTimeout(r, 200));

  // 2. Find the Live Spells Node (which is now visible)
  const selectors = [
      '[class*="styles_primaryBox"]',
      '.ct-primary-box', 
      '.ddbc-box-background + div section',
      '.sheet-body section'
  ];
  
  let spellsNode = null;
  for (const selector of selectors) {
      const matches = document.querySelectorAll(selector);
      const visibleMatch = Array.from(matches).find(el => {
          const style = window.getComputedStyle(el);
          return style.display !== 'none' && !el.classList.contains('hidden');
      });
      if (visibleMatch) {
          spellsNode = visibleMatch;
          break;
      }
  }

  // Go up to structural parent if needed
  if (spellsNode && (
      spellsNode.parentElement.className.includes('primaryBox') ||
      spellsNode.parentElement.className.includes('ct-primary-box')
  )) {
      spellsNode = spellsNode.parentElement;
  }

  if (!spellsNode) {
      console.error('[DDB Print] Could not find Live Spells Node! Aborting injection.');
      return;
  }

  // 3. Clean up the Live Spells Node (Hide UI, Fix Layout)
  // We apply the same fixes as we did for clones, but IN PLACE.
  spellsNode.querySelectorAll('menu').forEach(el => el.style.display = 'none');
  spellsNode.querySelectorAll('[data-testid="tab-filters"]').forEach(el => el.style.display = 'none');
  
  spellsNode.style.cssText += 'height: fit-content !important; display: flex !important; flex-direction: column !important; max-height: none !important; overflow: visible !important;';
  
  spellsNode.querySelectorAll('section, .ct-primary-box').forEach(el => {
      el.style.cssText += 'height: fit-content !important; display: flex !important; flex-direction: column !important; max-height: none !important; overflow: visible !important;';
  });

  // Targeted SVG Removal for Spells: Use helper function
  removeSpecificSvgs(spellsNode);

  // We RESTORE the logic for other SVGs as per user request.
  const bgSvgs = spellsNode.querySelectorAll('.ct-primary-box > svg, svg.ddbc-rep-box-background__svg, .ddbc-box-background:not([style*="display: none"]) svg');
  bgSvgs.forEach(svg => {
      svg.style.height = '100%';
      svg.style.width = '100%';
      if(svg.hasAttribute('height')) svg.removeAttribute('height');
      if(svg.hasAttribute('width')) svg.removeAttribute('width');
      svg.setAttribute('preserveAspectRatio', 'none');
  });

  // Explicitly fix Group Boxes (Proficiency, Skills, Senses, Saving Throws) in Spells View
  const groupBoxSvgs = spellsNode.querySelectorAll('.ct-proficiency-groups-box svg, .ct-senses-box svg, .ct-skills-box svg, .ct-saving-throws-box svg');
  groupBoxSvgs.forEach(svg => {
       svg.setAttribute('preserveAspectRatio', 'none');
       svg.style.width = '100%';
       svg.style.height = '100%';
  });

  // 4. Identify the Unified Layout Root
  // We want to move everything to .ct-subsections
  const layoutRoot = document.querySelector('.ct-subsections');
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
          const titleEl = child.querySelector('header, .ct-subsection__header');
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

  // 8. Hide Navigation UI
  const navTabs = document.querySelector('.ct-character-sheet-desktop nav') || 
                  document.querySelector('nav[class*="styles_navigation"]');
  if (navTabs) {
      navTabs.style.display = 'none';
  }
  
  // Clean up global definitions
  copySvgDefinitions(document.body); 
}

/**
 * Relocates defense information.
 */
function moveDefenses() {
  const defensesSection = safeQuery(['.ct-sidebar__section--defenses', '[class*="sidebar__section--defenses"]']);
  if (!defensesSection) return;

  const elem = defensesSection.cloneNode(true);
  removeSpecificSvgs(elem); // Ensure SVGs are removed from Defenses clone
  const header = elem.querySelector(['.ct-sidebar__section-header', '[class*="sidebar__section-header"]']);
  if (header) header.remove();

  const combatTablet = safeQuery(['.ct-status-summary-bar', '[class*="status-summary-bar"]']);
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
  // Hide major UI components
  safeQueryAll([
    'div.site-bar', 'header.main', '#mega-menu-target', 
    '[class*="navigation"]', '[class*="mega-menu"]', '[class*="sidebar"]', 'footer'
  ]).forEach(e => { e.style.display = 'none'; });

  const name = safeQuery(['.ct-character-tidbits__name', '[class*="tidbits__name"]']);
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
    const portrait = document.querySelector('.ddbc-character-avatar__portrait');
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
    const quickInfo = document.querySelector('.ct-quick-info');
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
  const searchSelectors = [
    '.header-wrapper',
    '.ct-spells-filter',
    '.ct-inventory__filter',
    '.ct-equipment__filter',
    '.ct-extras__filter',
    '.ct-features__management-link',
    '.ct-filter-box', 
    'input[type="search"]',
    '[class*="filter"]',
    '.ct-application-group__filter'
  ];

  safeQueryAll(searchSelectors).forEach(el => {
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

  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = `
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

        /* Deep Clean: Aggressively hide top elements */
        .site-bar, 
        nav, 
        header, 
        .ddb-site-alert, 
        .watermark, 
        footer, 
        #mega-menu-target, 
        .mm-navbar,
        .notifications-wrapper {
            display: none !important;
        }

        .ct-character-sheet-desktop {
            margin: 0 !important;
            padding: 0 !important;
            /* Force absolute top to ignore any flow */
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
        }
             
        p, 
        span,
        div.ct-content-group { 
            break-inside: avoid; 
        }
    }

    :root {
        /* Using your provided Base64 string */
        --border-img: url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEQAAABECAYAAAA4E5OyAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAQ9SURBVHhe7ZxBbtswFERzpZwj58g5cozkGMkhukm67K6rFAnQrtpdu3KKETrCePw/JaquqEYcYBBXssXPx0/yW7Z78bZAH6+u3j5cXm7aiHGJLvzAHHUgJm98q16iaiDfHh6OGv1ydzccy/z55mZ8Lkbt+fb27ev9/SzjuZqNuJZfX41YNDYcq1UVkF+vr0cNfrq+9qeM+vH0NHYGf9HBw+GwyHitXgvXzoSYNEbEXKPZQBwGHAWGUWLwGOGfLy8nHVxqXAvXJBi05UJMHmcNlFlAokaQvio0ytFB0N6Zc5tg0KZ3WKdpafAiFYFoJ9U+VTh3MWrnzIgpoy1mo2dLFrfDc4VA8CJfoGjNjLWzInOWLVGmEF4GZgRCCBFZ2Ocs1xQc//74eBLk2kYMzBbtrK5pbvTV4YxAMhCwpyNhYAQ8sNZmVngGZBlPMNQIJKLo9CDCwEU8GHhtefswBzeKPQKjVW0IxHcQagrGVoCUoFBeMFIjECWWVXhoBC/2xrcIBEasviNS6KP2mRqAcOTpaM8G0RKM1vJ4FEqU8V5bMZMGINlJf3FpN2ktj4dGzNEgZ0kwAPH0cSA4NlVntJbHo2adonIgXCZCICquyt6Iu7U8Hjf64OVDCsS3IhXm4FR2/A9AeCtBpX0mrAGIbkG6KjNz/OKRW8vjiayZAGkxyoW3CGRudsCt5fFE9ixJgUQnuLP4RTO3lseTGX3ijhIlwgAkqlLxt+a9Smt5PJnZLyiqVi/wQIFwcamZLnBreTyZddroZkIOAxAehLno4HHNfdDW8ngyo0/oG+TlRggE84tPrLn71VoeT2b0iQPvFfoARA8oEJz0i5XcWh5PyehbBAQ+AYJ5Vbugwq3l8ZTM/nlBGgLhYlrbSGt5PCVD/iHYCRCc5HZUkl9cG2kpj2duXOizgulAOpBjdSCmDsTUgZg6EFMHYupATJNA8Pg9VapTSoEomPcEJDI0WbrT/c2dHdj9239Pm93fIHIg/RZiv8k8whiA4IQCYS1Su7C2lseTmf2CWGYQCNQ/qPrT76MPqqITUM20aS2PJ/LsjzIzILv9sNsLFNXcLGktj8ft2QFpn4++DuHbj2qXX5hxILv/SpVXbA5kd1+6y06qsOhgDnqDWweCmLlgqrIkGIBAelJXYtVuvrgLRdWqa1df7VYgNFZlv+AUlLXl7Zdg4N9eYqRAtEhx+3ZFKDXvddYyR95hRCBonVYjENLLwICigiEUHC/tPmv57D8gUmWpBev6gucR4FSd8i/NOgOxaOd0nVA7BFUIhNIOO1kV4WEkau6y/a1X+xGiy/ds2HeitbMlywooyoyotoo0CwjENWOqEZ2zCPqcGbOZHzJTDsWnjgqBEQz+1tyfdW/yp+6UV3gYJRzL7AUQRtj/04PM/mESruXXV/tGgGO1qgYCaaNb9hItApLt61uyVp816kBMvwHf7+SOVWGMwQAAAABJRU5ErkJggg==');
    }

    .print-section-content {
      overflow: visible !important;
      max-height: none !important;
      padding: 0;
      height: auto !important;
    }
    section {
      height: 100% !important;
      padding: 0 !important;
    }

    #character-tools-target {
        background-color: white;
    }

    dialog + div,
    .dice-rolling-panel,
    .ct-character-sheet:before,
    .ddbc-theme-link,
    .ddbc-character-tidbits__heading,
    .ct-extras-filter__interactions,
    .ct-inventory-filter,
    .ct-spells-spell__action,
    .ct-features__management-link,
    .ct-subsection__footer,
    .ct-character-header-desktop,
    .ct-quick-info__inspiration,
    .ct-quick-info__health h1 + div {
      display: none!important;
    }
    .ct-quick-info__health h1 {
      position: static;
      transform: none;
    }
    /* REsizable */
    .ct-character-sheet-desktop .ct-subsection {
        position: static!important;
        display: flex!important;
        flex-flow: row!important;
        height: 100%;
    }
    .ct-character-sheet-desktop .ct-subsections {
        height: auto !important;
        display: block;
        width: 100%;
        position: relative !important;
    }

    /* User Request: Side Panel Fixed & Scrollable */
    .ct-sidebar__portal {
        position: fixed !important;
        top: 0 !important;
        right: 0 !important;
        height: 100% !important;
        z-index: 9999 !important;
    }
    .ct-spell-manager {
        overflow-y: auto !important;
        max-height: 100% !important;
    }
    .ct-sidebar {
        position: static !important;
    }
    .ct-sidebar__inner {
        overflow-y: auto !important;
        overflow-x: hidden !important;
    }
    .ct-character-sheet {
        background-color: #333;
    }
    .ct-character-sheet-desktop {
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
        .ct-primary-box {
            width: 100% !important;
        }
    }

    @media screen {
        .ct-character-sheet-desktop {
            max-width: none !important;
            margin: 0 !important;
            width: 100% !important;
            background-color: white !important;
        }
    }
    
    .print-section-container { 
        break-inside: avoid; 
        position: absolute !important;
        z-index: 10;
        /* resize: both !important; Removed for custom handle */
        overflow: hidden !important; /* Changed from auto to hidden, we'll handle scroll/scale */
        min-width: 50px !important;
        min-height: 30px !important;
        background-color: white;
        box-sizing: border-box;
        display: flex !important;
        flex-direction: column !important;
        border-width: 20px;
        border-style: solid;
        border-color: transparent;
        border-image-source: var(--border-img);
        border-image-slice: 20;
        border-image-repeat: stretch;
        box-decoration-break: clone;
        -webkit-box-decoration-break: clone;
    }
    .print-section-container:hover { 
        box-shadow: 2px 2px 5px rgba(0,0,0,0.1);
    }

    .print-section-container, 
    .print-section-container * {
        font-size: 8px !important;
        white-space: normal !important;
        overflow-wrap: break-word !important;
    }
    .print-section-container .ct-combat__statuses h2 *,
    .print-section-container .ct-combat__statuses h2 + *,
    .print-section-container .ct-quick-info * {
        font-size: 12px !important;
    }
    .print-section-container .ct-quick-info__health * {
        font-size: 14px !important;
    }
    @media print {
        body, .ct-character-sheet-desktop {
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
            transform: none !important;
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
    .ct-senses__callout-value,
    .integrated-dice__container,
    .integrated-dice__container span {
        font-size: 16px !important;
    }
    .ddbc-armor-class-box__value {
        font-size: 26px !important;
    }

    /* Scaling helper */
    .print-section-container[data-scaling="true"] .print-section-content > div {
        transform-origin: top left;
    }

    .ddbc-character-avatar__portrait {
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
        background-color: #979797;
        line-height: 18px;
        left: 32px;
        border-radius: 32px;
        padding: 0 16px;
        filter: drop-shadow(2px 4px 6px black);
        min-width: max-content;
    }
    .print-section-container:hover .print-section-header {
        opacity: 1;
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
    .print-section-container:hover .print-section-resize-handle {
        opacity: 1;
        background: linear-gradient(135deg, transparent 50%, #979797 50%);
    }

    /* Skills specific compact logic (already mostly covered by global above) */
    .ct-skills, .ct-skills * {
        font-size: 8px !important;
    }

    /* Minimized state */
    .print-section-container.minimized {
        position: fixed !important;
        left: 0 !important;
        bottom: 0 !important;
        width: 16px !important;
        height: 16px !important;
        min-width: 0 !important;
        margin: 0 !important;
        padding: 0 !important;
        z-index: 10000 !important;
        background-color: #eee !important;
        resize: none !important;
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
  `;
  document.head.appendChild(style);
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
        const section = e.target.closest('.print-section-container');
        if (!section) return;

        // Find max z-index
        const allSections = document.querySelectorAll('.print-section-container');
        let maxZ = 10;
        allSections.forEach(el => {
            const z = parseInt(window.getComputedStyle(el).zIndex) || 10;
            if (z > maxZ) maxZ = z;
        });

        // Set clicked section to max + 1
        section.style.zIndex = maxZ + 1;
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
    
    containers.forEach(container => {
        // User Request: Override width of IMMEDIATE divs
        Array.from(container.children).forEach(child => {
            if (child.tagName === 'DIV') {
                const currentWidth = parseInt(window.getComputedStyle(child).width, 10);
                if (!isNaN(currentWidth)) {
                    const newWidth = currentWidth + deltaX;
                    child.style.width = `${newWidth}px`;
                    // Also set min/max width if they might constrain it? User said "Override", so:
                    child.style.minWidth = `${newWidth}px`; 
                    // child.style.maxWidth = `${newWidth}px`; // Maybe too aggressive?
                }
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
    const sheetDesktop = document.querySelector('.ct-character-sheet-desktop');
    if (sheetDesktop) {
        sheetDesktop.style.minHeight = minH;
        // height: auto is usually enough on parent if child pushes it, but flex/grid/absolute might interfere
        sheetDesktop.style.height = 'auto'; 
    }
    
    const sheetInner = document.querySelector('.ct-character-sheet__inner');
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
    container.style.opacity = '0.3';
    container.style.transition = 'opacity 0.3s, transform 0.3s';
    
    // Hover logic
    container.addEventListener('mouseenter', () => {
        container.style.opacity = '1';
        container.style.transform = 'scale(1.02)';
    });
    container.addEventListener('mouseleave', () => {
        container.style.opacity = '0.3';
        container.style.transform = 'scale(1)';
    });

    const buttons = [
        { label: 'Save Browser', icon: '💾', action: handleSaveBrowser },
        { label: 'Save PC', icon: '💻', action: handleSavePC },
        { label: 'Load Default', icon: '🔄', action: handleLoadDefault },
        { label: 'Load', icon: '📂', action: handleLoadFile },
        { label: 'Contribute', icon: '⭐', action: () => window.open('https://github.com/luiscla27/beyond-print-enhancer', '_blank') }
    ];

    buttons.forEach(btnInfo => {
        const btn = document.createElement('button');
        btn.innerHTML = `<span style="margin-right: 5px;">${btnInfo.icon}</span> ${btnInfo.label}`;
        btn.style.backgroundColor = '#333';
        btn.style.color = 'white';
        btn.style.border = '1px solid #555';
        btn.style.padding = '6px 12px';
        btn.style.borderRadius = '4px';
        btn.style.cursor = 'pointer';
        btn.style.fontSize = '12px';
        btn.style.textAlign = 'left';
        btn.style.transition = 'background-color 0.2s';
        
        btn.onmouseenter = () => btn.style.backgroundColor = '#444';
        btn.onmouseleave = () => btn.style.backgroundColor = '#333';
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
 * Handles saving the layout to IndexedDB.
 */
async function handleSaveBrowser() {
    try {
        await Storage.init();
        const layout = scanLayout();
        await Storage.saveGlobalLayout(layout);
        
        // Also save for specific character for the "revert to character" feature later
        const characterId = window.location.pathname.split('/').pop();
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
function handleSavePC() {
    const layout = scanLayout();
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
                section.style.setProperty(prop, val, 'important');
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
        
        const characterId = window.location.pathname.split('/').pop();
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
        reader.onload = (event) => {
            try {
                const layout = JSON.parse(event.target.result);
                if (Storage.validateLayout(layout)) {
                    applyLayout(layout);
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
        const characterId = window.location.pathname.split('/').pop();
        let layout = null;
        
        if (characterId) {
            layout = await Storage.loadLayout(characterId);
        }
        
        if (!layout) {
            layout = await Storage.loadGlobalLayout();
        }

        if (layout && Storage.validateLayout(layout)) {
            console.log('[DDB Print] Restoring saved layout...');
            applyLayout(layout);
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
function scanLayout() {
    const layout = {
        version: "1.0.0",
        sections: {}
    };

    const sections = document.querySelectorAll('.print-section-container');
    sections.forEach(section => {
        const id = section.id;
        if (!id) return;

        layout.sections[id] = {
            left: section.style.left,
            top: section.style.top,
            width: section.style.width,
            height: section.style.height,
            zIndex: section.style.zIndex || '10',
            minimized: section.dataset.minimized === 'true',
            innerWidths: {}
        };

        // Scan inner content for width overrides
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

    return layout;
}

/**
 * Migrates layout data from older versions to the current schema.
 * @param {object} data 
 * @returns {object} Migrated data.
 */
function migrateLayout(data) {
    if (!data || typeof data !== 'object') return data;
    
    // Future migration logic goes here
    // Example: if (data.version === '0.9.0') { ... }
    
    return data;
}

/**
 * Applies layout information to the current DOM.
 * @param {object} layout 
 */
function applyLayout(layout) {
    layout = migrateLayout(layout);
    if (!layout || !layout.sections) return;

    for (const [id, styles] of Object.entries(layout.sections)) {
        const section = document.getElementById(id);
        if (!section) continue;

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

    // Expose for testing synchronously

    window.createDraggableContainer = createDraggableContainer;
    window.extractAndWrapSections = extractAndWrapSections;
    window.injectClonesIntoSpellsView = injectClonesIntoSpellsView;
    window.initDragAndDrop = initDragAndDrop;
    window.enforceFullHeight = enforceFullHeight;
    window.removeSearchBoxes = removeSearchBoxes;
    window.tweakStyles = tweakStyles;
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
    window.adjustInnerContentWidth = adjustInnerContentWidth;
    window.scanLayout = scanLayout;
    window.applyLayout = applyLayout;
    window.applyDefaultLayout = applyDefaultLayout;
    window.handleSaveBrowser = handleSaveBrowser;
    window.restoreLayout = restoreLayout;
    window.showFeedback = showFeedback;
    window.createControls = createControls;
    window.showFallbackModal = showFallbackModal;
    window.Storage = Storage;

// Execution
(async () => {
    if (window.__DDB_TEST_MODE__) return;
    
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
    removeSearchBoxes();
    movePortrait(); // User Request: Move portrait at the end
    moveQuickInfo(); // User Request: Make Quick Info draggable
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