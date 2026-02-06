/*
Copyright 2019 Adam Pritchard
Licensed under Blue Oak Model License 1.0.0
*/

(function () {
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
  header.textContent = title;
  header.setAttribute('draggable', 'true'); // Added here instead
  
  header.style.fontWeight = 'bold';
  header.style.fontSize = '1.2em';
  header.style.padding = '5px';
  header.style.borderBottom = '1px solid black';
  header.style.backgroundColor = '#eee';

  container.appendChild(header);
  
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

            // Fix Background SVGs to stretch
            // Usually found in .ddbc-box-background or similar containers acting as borders
            // User Request: Recalculate paths/sizes. We achieve this by unlocking the aspect ratio 
            // and letting the SVG conform to the flex container's fluid size.
            const bgSvgs = clone.querySelectorAll('.ddbc-box-background svg, .ct-primary-box > svg, svg.ddbc-rep-box-background__svg');
            bgSvgs.forEach(svg => {
                svg.style.height = '100%';
                svg.style.width = '100%';
                // Important: Unset fixed attributes if they exist to let CSS rule
                if(svg.hasAttribute('height')) svg.removeAttribute('height');
                if(svg.hasAttribute('width')) svg.removeAttribute('width');
                
                // Allow stretching to fill the new container shape (which changes based on content)
                svg.setAttribute('preserveAspectRatio', 'none');
                
                // Note: We do NOT remove viewBox, as it defines the coordinate system for the paths.
                // By unconstraining aspect ratio + 100% size, the browser maps 0..623 x 0..660 to 0..clientWidth x 0..clientHeight.
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

  const bgSvgs = spellsNode.querySelectorAll('.ddbc-box-background svg, .ct-primary-box > svg, svg.ddbc-rep-box-background__svg');
  bgSvgs.forEach(svg => {
      svg.style.height = '100%';
      svg.style.width = '100%';
      if(svg.hasAttribute('height')) svg.removeAttribute('height');
      if(svg.hasAttribute('width')) svg.removeAttribute('width');
      svg.setAttribute('preserveAspectRatio', 'none');
  });

  // 4. Identify the Unified Layout Root
  // We want to move everything to .ct-subsections
  const layoutRoot = document.querySelector('.ct-subsections');
  if (!layoutRoot) {
      console.warn('[DDB Print] Could not find .ct-subsections! Falling back to original parent.');
      return;
  }

  // 5. Wrap existing Children (Skills, Senses, etc.)
  // These are already in the DOM, we want to wrap them if they aren't already.
  Array.from(layoutRoot.children).forEach(child => {
      if (!child.classList.contains('print-section-container')) {
          // Identify a title for the section (e.g. from a header)
          const titleEl = child.querySelector('header, .ct-subsection__header');
          const title = titleEl ? titleEl.textContent.trim() : 'Section';
          
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
 * Drag and Drop Engine
 */
let draggedItem = null;
function initDragAndDrop() {
  const container = document.getElementById('print-layout-wrapper');
  if (!container) return;

  container.addEventListener('dragstart', e => {
    draggedItem = e.target.closest('.print-section-container');
    if (draggedItem) {
        e.dataTransfer.effectAllowed = 'move';
        draggedItem.style.opacity = '0.4';
    }
  });

  container.addEventListener('dragover', e => {
    e.preventDefault();
    return false;
  });

  container.addEventListener('drop', e => {
    e.stopPropagation();
    const target = e.target.closest('.print-section-container');
    if (draggedItem && target && draggedItem !== target) {
        const rect = target.getBoundingClientRect();
        // Improved heuristic for inline-block/grid layout
        // Check if mouse is in the second half of the element (horizontally or vertically)
        const isHorizontal = (e.clientX - rect.left) / (rect.right - rect.left) > 0.5;
        const isVertical = (e.clientY - rect.top) / (rect.bottom - rect.top) > 0.5;
        
        // If we are in the second half of the box, insert after
        const next = isHorizontal || isVertical;
        container.insertBefore(draggedItem, next ? target.nextSibling : target);
    }
    return false;
  });

  container.addEventListener('dragend', () => {
    if (draggedItem) draggedItem.style.opacity = '1';
    draggedItem = null;
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
    :not(svg):not(g)[class*="content"], .print-section-content {
      overflow: visible !important;
      max-height: none !important;
      height: auto !important;
    }
    .ddbc-character-tidbits__heading,
    .ct-character-header-desktop,
    .ct-quick-info__inspiration,
    .ct-quick-info__health h1 + div {
      display: none!important;
    }
    .ct-quick-info__health h1 {
      position: relative;
    }
    /* REsizable */
    .ct-character-sheet-desktop .ct-subsection {
        position: static!important;
        display: flex!important;
        flex-flow: row!important;
    }
    .ct-character-sheet-desktop .ct-subsections {
        height: 770px;
        display: flex;
        width: 100%;
        flex-flow: row;
        flex-wrap: wrap;
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
    @page { 
        size: letter landscape; 
        margin: 0.5in; 
    }
    
    @media screen {
        .ct-character-sheet-desktop {
            max-width: 11in !important;
            margin: 0 auto !important;
            background-color: white !important;
            box-shadow: 0 0 10px rgba(0,0,0,0.1);
        }
    }
    
    @media print {
        body, .ct-character-sheet-desktop {
            width: 11in !important; /* 11in (landscape width) - no margins */
            margin: 0 !important;
            padding: 0 !important;
        }
    }
    
    .print-section-container { 
        break-inside: avoid; 
        margin-bottom: 20px; 
        border: 1px solid #ccc; 
        display: inline-block;
        vertical-align: top;
        resize: horizontal !important;
        overflow: auto !important;
        min-width: 200px !important;
        background-color: white;
        margin-right: 15px !important;
        margin-bottom: 15px !important;
        box-sizing: border-box;
        position: relative !important;
        z-index: 10;
        box-shadow: 2px 2px 5px rgba(0,0,0,0.1);
        scrollbar-width: none !important; /* Firefox */
        -ms-overflow-style: none !important;  /* IE/Edge */
    }

    .print-section-container::-webkit-scrollbar {
        display: none !important; /* Chrome/Safari */
    }

    .print-section-container, 
    .print-section-container * {
        font-size: 8px !important;
        white-space: normal !important;
        overflow-wrap: break-word !important;
    }

    .print-section-header {
        cursor: move;
        user-select: none;
        font-size: 10px !important; /* Slightly larger for clarity */
        padding: 4px !important;
    }

    /* Skills specific compact logic (already mostly covered by global above) */
    .ct-skills, .ct-skills * {
        font-size: 8px !important;
    }
  `;
  document.head.appendChild(style);
}

    // Expose for testing synchronously
    window.extractAndWrapSections = extractAndWrapSections;
    window.injectClonesIntoSpellsView = injectClonesIntoSpellsView;
    window.initDragAndDrop = initDragAndDrop;
    window.enforceFullHeight = enforceFullHeight;
    window.removeSearchBoxes = removeSearchBoxes;
    window.tweakStyles = tweakStyles;
    window.moveDefenses = moveDefenses;

// Execution
(async () => {
    if (window.__DDB_TEST_MODE__) return;
    
    // Idempotency: cleanup previous run if exists
    const existingWrapper = document.getElementById('print-layout-wrapper');
    if (existingWrapper) existingWrapper.remove();

    enforceFullHeight();
    await injectClonesIntoSpellsView();
    moveDefenses();
    tweakStyles();
    removeSearchBoxes();
    initDragAndDrop();
    
    /* global createControls, restoreLayout */
    if (typeof createControls === 'function') createControls();
    if (typeof restoreLayout === 'function') await restoreLayout();
})();
})();