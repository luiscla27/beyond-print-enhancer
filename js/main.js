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
  container.setAttribute('draggable', 'true');
  
  const header = document.createElement('div');
  header.className = 'print-section-header';
  header.textContent = title;
  
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
      title: t.textContent.trim()
  })).filter(s => s.name);

  const extractedContainers = [];

  for (const section of sectionsToExtract) {
    const target = navToSection(section.name);
    
    // Give React time to render. Using Promise-based delay to be safe.
    await new Promise(r => setTimeout(r, 500));

    if (target || tabs.length > 0) { // Proceed if navigation worked or we're just trying
        // Priority: Find the main structural container that holds the styles
        // 1. styles_primaryBox (Dynamic hash class)
        // 2. ct-primary-box (Standard class)
        // 3. Fallback to generic content areas
        let content = safeQuery([
            '[class*="styles_primaryBox"]',
            '.ct-primary-box', 
            '.ddbc-box-background + div section',
            '.sheet-body section'
        ]);

        if (content) {
            // Refinement: If we matched a child but the parent is the actual styled container, go up.
            if (content.parentElement && (
                content.parentElement.className.includes('primaryBox') ||
                content.parentElement.className.includes('ct-primary-box')
            )) {
                content = content.parentElement;
            }

            console.log(`[DDB Print] Extracted content for ${section.name}:`, content.className);

            const clone = content.cloneNode(true);
            
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
async function appendExtractedSections() {
  const containers = await extractAndWrapSections();
  
  // Find insertion point
  const contentArea = safeQuery(['.ct-character-sheet-desktop','.ct-character-sheet-content', '[class*="sheet-content"]']);
  
  if (contentArea && contentArea.parentElement) {
    const parent = contentArea.parentElement;
    
    const printWrapper = document.createElement('div');
    printWrapper.id = 'print-layout-wrapper';
    
    // Simulate main sheet structure for styles
    printWrapper.classList.add('ct-character-sheet-desktop', 'ct-character-sheet-content'); 
    
    copySvgDefinitions(printWrapper); // Copy sprites/defs
    containers.forEach(c => printWrapper.appendChild(c));
    parent.appendChild(printWrapper);
  }
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
        const next = (e.clientY - rect.top) / (rect.bottom - rect.top) > 0.5;
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
    '.ct-spells-filter',
    '.ct-inventory__filter',
    '.ct-filter-box', 
    'input[type="search"]',
    '[class*="filter"]',
    '.ct-application-group__filter'
  ];

  safeQueryAll(searchSelectors).forEach(el => el.remove());
}

function enforceFullHeight() {
    const styleId = 'ddb-print-enhance-style';
    if (document.getElementById(styleId)) return;

  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = `
    [class*="content"], .print-section-content {
      overflow: visible !important;
      max-height: none !important;
      height: auto !important;
    }
    @media print {
        @page { size: letter; margin: 0.5in; }
        .print-section-container { break-inside: avoid; margin-bottom: 20px; border: 1px solid #ccc; }
    }
  `;
  document.head.appendChild(style);
}

// Execution
(async () => {
    // Idempotency: cleanup previous run if exists
    const existingWrapper = document.getElementById('print-layout-wrapper');
    if (existingWrapper) existingWrapper.remove();

    enforceFullHeight();
    await appendExtractedSections();
    moveDefenses();
    tweakStyles();
    removeSearchBoxes();
    initDragAndDrop();
    
    /* global createControls, restoreLayout */
    if (typeof createControls === 'function') createControls();
    if (typeof restoreLayout === 'function') await restoreLayout();
})();

})();