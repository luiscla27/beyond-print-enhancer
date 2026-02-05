/*
Copyright 2019 Adam Pritchard
Licensed under Blue Oak Model License 1.0.0
*/

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
  return Array.from(elements).find(el => 
    el.textContent.trim().toLowerCase() === text.toLowerCase() && 
    el.children.length === 0
  );
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
  // Prioritize the known obfuscated class pattern for tab buttons
  const tabs = safeQueryAll('button[class*="tabButton"]');
  let target = tabs.find(tab => tab.textContent.toLowerCase().includes(name.toLowerCase()));
  
  // Fallback to text search on any button/link
  if (!target) {
    target = findByText(name, 'button') || findByText(name, 'a') || findByText(name, 'span');
  }

  if (target) {
    const clickTarget = target.tagName === 'BUTTON' ? target : target.closest('button');
    if (clickTarget) {
        clickTarget.click();
        return true;
    }
  }
  
  console.error(`[DDB Print Enhance] Could not find tab for section: ${name}`);
  return false;
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
async function extractAndWrapSections() {
  const sectionsToExtract = [
    { name: 'actions', title: 'Actions' },
    { name: 'spells', title: 'Spells' },
    { name: 'equipment', title: 'Equipment' },
    { name: 'features', title: 'Features & Traits' }
  ];
  
  const extractedContainers = [];

  for (const section of sectionsToExtract) {
    if (navToSection(section.name)) {
      // Wait for React to switch content
      await sleep(100); 
      
      // Look for the content area which usually has 'content' in its obfuscated class
      const content = findByClassPattern('content', 'div') || safeQuery('.ct-character-sheet-content');
      if (content) {
        extractedContainers.push(createDraggableContainer(
          section.title, 
          content.cloneNode(true), 
          `section-${section.name}`
        ));
      }
    }
  }

  return extractedContainers;
}

/**
 * Appends all collected sections to the main sheet view.
 */
async function appendExtractedSections() {
  const containers = await extractAndWrapSections();
  
  // Find insertion point (parent of the content area)
  const contentArea = findByClassPattern('content', 'div') || safeQuery('.ct-character-sheet-content');
  
  if (contentArea && contentArea.parentElement) {
    const parent = contentArea.parentElement;
    const printWrapper = document.createElement('div');
    printWrapper.id = 'print-layout-wrapper';
    
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
  // Remove top site navigation and sidebars
  safeQueryAll([
    'div.site-bar', 'header.main', '#mega-menu-target', 
    '[class*="navigation"]', '[class*="mega-menu"]', '[class*="sidebar"]', 'footer'
  ]).forEach(e => e.remove());

  const name = safeQuery(['.ct-character-tidbits__name', '[class*="tidbits__name"]']);
  if (name) name.style['color'] = 'black';

  // HP recovery - look for numeric patterns that look like HP (e.g. 10 / 10)
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

function enforceFullHeight() {
  const style = document.createElement('style');
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
    enforceFullHeight();
    await appendExtractedSections();
    moveDefenses();
    tweakStyles();
    initDragAndDrop();
    
    /* global createControls, restoreLayout */
    if (typeof createControls === 'function') createControls();
    if (typeof restoreLayout === 'function') await restoreLayout();
})();