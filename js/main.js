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
      console.warn(`[DDB Print Enhance] Invalid selector skipped: ${selector}`);
    }
  }
  
  console.warn(`[DDB Print Enhance] No elements found for selectors: ${selectors.join(', ')}`);
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
      console.warn(`[DDB Print Enhance] Invalid selector skipped: ${selector}`);
    }
  }
  
  console.warn(`[DDB Print Enhance] No elements found for selectors: ${selectors.join(', ')}`);
  return [];
}

/**
 * Finds an element by its text content and optional selector.
 */
function findByText(text, selector = '*') {
  const elements = document.querySelectorAll(selector);
  return Array.from(elements).find(el => 
    el.textContent.trim().toLowerCase() === text.toLowerCase() && 
    el.children.length === 0 // Target leaf nodes (labels/buttons)
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
 * Uses text-based discovery for high resilience.
 */
function navToSection(name) {
  // Try finding by text directly (Actions, Spells, etc.)
  let target = findByText(name, 'button') || findByText(name, 'span') || findByText(name, 'a');
  
  // If not found, try finding the obfuscated tab button class from diagnostics
  if (!target) {
    const tabs = document.querySelectorAll('button[class*="tabButton"]');
    target = Array.from(tabs).find(tab => tab.textContent.toLowerCase().includes(name.toLowerCase()));
  }

  if (target) {
    // If we found a label inside a button, click the button
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
 * Collect content from all tabs and wrap them in draggable containers.
 */
function extractAndWrapSections() {
  const sectionsToExtract = [
    { name: 'actions', title: 'Actions' },
    { name: 'spells', title: 'Spells' },
    { name: 'equipment', title: 'Equipment' },
    { name: 'features', title: 'Features & Traits' }
  ];
  
  const extractedContainers = [];

  for (const section of sectionsToExtract) {
    if (navToSection(section.name)) {
      // Content container usually has 'content' in class name (e.g., _content_dbufq_8)
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
function appendExtractedSections() {
  const containers = extractAndWrapSections();
  
  // Try to find a reliable insertion point (the parent of the content area)
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
  // Remove top site navigation
  safeQueryAll([
    'div.site-bar', 'header.main', '#mega-menu-target', 
    '[class*="navigation"]', '[class*="mega-menu"]', 'footer'
  ]).forEach(e => e.remove());

  const name = safeQuery(['.ct-character-tidbits__name', '[class*="tidbits__name"]']);
  if (name) name.style['color'] = 'black';

  // HP recovery
  const hpTexts = Array.from(document.querySelectorAll('*')).filter(el => el.textContent.trim().match(/^\d+$/));
  if (hpTexts.length > 0) {
      // Bold the likely HP numbers
      hpTexts.forEach(el => { el.style['font-size'] = '20px'; });
  }
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
    appendExtractedSections();
    moveDefenses();
    tweakStyles();
    initDragAndDrop();
    
    /* global createControls, restoreLayout */
    if (typeof createControls === 'function') createControls();
    if (typeof restoreLayout === 'function') await restoreLayout();
})();
