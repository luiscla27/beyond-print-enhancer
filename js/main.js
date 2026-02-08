/*
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
  
  const titleSpan = document.createElement('span');
  titleSpan.textContent = title;
  header.appendChild(titleSpan);

  header.setAttribute('draggable', 'true'); // Added here instead
  
  header.style.fontWeight = 'bold';
  header.style.fontSize = '1.2em';
  header.style.padding = '5px';
  header.style.borderBottom = '1px solid black';
  header.style.backgroundColor = '#eee';
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
  layoutRoot.id = 'print-layout-wrapper';

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
            draggedItem.style.opacity = '0.4';
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
    :not(svg):not(g)[class*="content"], .print-section-content {
      overflow: visible !important;
      max-height: none !important;
      height: auto !important;
    }
    .ddbc-character-tidbits__heading,
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
    }
    .ct-character-sheet-desktop .ct-subsections {
        min-height: 100vh !important;
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
    @page { 
        size: letter; 
        margin: 0.5in; 
    }
    
    @media screen {
        .ct-character-sheet-desktop {
            max-width: none !important;
            margin: 0 !important;
            width: 100% !important;
            min-height: 100vh !important;
            background-color: transparent !important;
            box-shadow: none !important;
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
        border: 1px solid transparent; /* Hidden by default */
        position: absolute !important;
        z-index: 10;
        /* resize: both !important; Removed for custom handle */
        overflow: hidden !important; /* Changed from auto to hidden, we'll handle scroll/scale */
        min-width: 50px !important;
        min-height: 30px !important;
        background-color: white;
        box-sizing: border-box;
        box-shadow: 2px 2px 5px rgba(0,0,0,0.1);
        display: flex !important;
        flex-direction: column !important;
    }

    .print-section-content {
        flex: 1 1 auto !important;
        overflow: hidden !important;
        display: flex !important;
        flex-direction: column !important;
        position: relative !important;
    }

    .print-section-container, 
    .print-section-container * {
        font-size: 8px !important;
        white-space: normal !important;
        overflow-wrap: break-word !important;
    }

    /* Scaling helper */
    .print-section-container[data-scaling="true"] .print-section-content > div {
        transform-origin: top left;
    }

    .print-section-header {
        cursor: move;
        user-select: none;
        font-size: 10px !important;
        padding: 4px !important;
        opacity: 0; /* Hidden by default */
        transition: opacity 0.2s;
    }

    .print-section-container:hover {
        border: 1px solid #ccc;
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
        background: linear-gradient(135deg, transparent 50%, #ccc 50%);
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

    sections.forEach(section => {
        section.style.left = '0px';
        section.style.top = '0px'; 

        const width = section.offsetWidth || 300;
        const height = section.offsetHeight || 150;

        if (currentX + width > viewportWidth - 20 && currentX > 10) {
            // New row
            currentX = 10;
            currentY += rowHeight + gutter;
            rowHeight = 0;
        }

        // Snap to grid
        const snapX = Math.round(currentX / 16) * 16;
        const snapY = Math.round(currentY / 16) * 16;

        section.style.left = `${snapX}px`;
        section.style.top = `${snapY}px`;
        
        currentX += width + gutter;
        if (height > rowHeight) rowHeight = height;
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
        startWidth = parseInt(document.defaultView.getComputedStyle(resizingSection).width, 10);
        startHeight = parseInt(document.defaultView.getComputedStyle(resizingSection).height, 10);
        
        document.documentElement.addEventListener('mousemove', doResize, false);
        document.documentElement.addEventListener('mouseup', stopResize, false);
        e.stopPropagation();
        e.preventDefault();
    }

    function doResize(e) {
        if (!resizingSection) return;
        
        let newWidth = startWidth + (e.clientX - startX);
        let newHeight = startHeight + (e.clientY - startY);
        
        // Snap to 16px
        newWidth = Math.round(newWidth / 16) * 16;
        newHeight = Math.round(newHeight / 16) * 16;
        
        // Min dimensions
        if (newWidth < 50) newWidth = 48; // nearest 16 is 48
        if (newHeight < 30) newHeight = 32;

        resizingSection.style.width = newWidth + 'px';
        resizingSection.style.height = newHeight + 'px';
    }

    function stopResize() {
        resizingSection = null;
        document.documentElement.removeEventListener('mousemove', doResize, false);
        document.documentElement.removeEventListener('mouseup', stopResize, false);
        updateLayoutBounds();
    }
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
    container.style.minHeight = Math.max(newHeight, window.innerHeight) + 'px';
    container.style.minWidth = Math.max(newWidth, window.innerWidth) + 'px';
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
    window.initResponsiveScaling = initResponsiveScaling;
    window.initZIndexManagement = initZIndexManagement;
    window.autoArrangeSections = autoArrangeSections;
    window.initResizeLogic = initResizeLogic;
    window.updateLayoutBounds = updateLayoutBounds;

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
    initResponsiveScaling();
    initZIndexManagement();
    initResizeLogic();
    
    /* global createControls, restoreLayout */
    if (typeof createControls === 'function') createControls();
    
    let layoutRestored = false;
    if (typeof restoreLayout === 'function') {
        layoutRestored = await restoreLayout();
        if (layoutRestored) updateLayoutBounds();
    }
    
    if (!layoutRestored) {
        autoArrangeSections();
    }
})();
})();