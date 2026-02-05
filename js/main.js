/*
Copyright 2019 Adam Pritchard
Licensed under Blue Oak Model License 1.0.0
*/

/**
 * Safely query an element, logging a warning if not found.
 */
function safeQuery(selector, context = document) {
  const element = context.querySelector(selector);
  if (!element) {
    console.warn(`[DDB Print Enhance] Element not found: ${selector}`);
  }
  return element;
}

/**
 * Safely query multiple elements.
 */
function safeQueryAll(selector, context = document) {
  const elements = context.querySelectorAll(selector);
  if (elements.length === 0) {
    console.warn(`[DDB Print Enhance] No elements found for selector: ${selector}`);
  }
  return Array.from(elements);
}

/**
 * Navigate to a specific character sheet section (tab).
 */
function navToSection(name) {
  const tabs = safeQueryAll('.ct-character-sheet-navigation__tab');
  const targetTab = tabs.find(tab => {
    const label = tab.querySelector('.ct-character-sheet-navigation__tab-label');
    return label && label.textContent.toLowerCase().includes(name.toLowerCase());
  });

  if (targetTab) {
    targetTab.click();
  } else {
    console.error(`[DDB Print Enhance] Could not find tab for section: ${name}`);
  }
}

/**
 * Collect content from Actions, Spells, and Equipment sections.
 */
function getAllSections() {
  const sectionNames = ['actions', 'spells', 'equipment'];
  const sectionElements = [];

  for (const name of sectionNames) {
    navToSection(name);
    // Wait briefly for React to render? Content might be dynamic.
    // For now, assume it's synchronous enough for cloneNode after click.
    const content = safeQuery('.ct-character-sheet-content');
    if (content) {
      sectionElements.push(content.cloneNode(true));
    }
  }

  // Return to default section (usually 'Combat' or 'Main')
  navToSection('actions'); // Or whatever the primary tab is now

  return sectionElements;
}

/**
 * Appends all collected sections to the main sheet view.
 */
function appendAllSections() {
  const sections = getAllSections();
  const mainContent = safeQuery('.ct-character-sheet-content');

  if (mainContent && mainContent.parentElement) {
    const parent = mainContent.parentElement;
    for (const section of sections) {
      parent.appendChild(section);
    }
  }
}

/**
 * Relocates defense information from the sidebar to the main combat tablet area.
 */
function moveDefenses() {
  // Find the defenses section in the sidebar
  let defensesSection = document.querySelector('.ct-sidebar__section--defenses');

  // If not found, try to open the sidebar (this part is speculative for the new UI)
  if (!defensesSection) {
    const sidebarToggle = document.querySelector('.ct-sidebar__header, .ct-character-tidbits__name');
    if (sidebarToggle) {
      sidebarToggle.click();
      defensesSection = document.querySelector('.ct-sidebar__section--defenses');
    }
  }

  if (!defensesSection) {
    console.warn('[DDB Print Enhance] Could not find or open Defenses section.');
    return;
  }

  const elem = defensesSection.cloneNode(true);

  // Clean up the cloned element
  const header = elem.querySelector('.ct-sidebar__section-header');
  if (header) header.remove();

  for (const e of elem.querySelectorAll('.ct-sidebar__section-content')) {
    e.style['margin'] = '0';
    e.style['padding'] = '5px';
    e.style['font-size'] = '12px';
  }

  // Target the combat summary area
  const combatTablet = safeQuery('.ct-status-summary-bar');
  if (combatTablet) {
    const container = document.createElement('div');
    container.style['border'] = 'thin black solid';
    container.style['margin-top'] = '10px';
    container.style['padding'] = '5px';
    container.appendChild(elem);
    combatTablet.parentElement.appendChild(container);
  }
}

/**
 * Strips away non-essential web elements and optimizes layout for print.
 */
function tweakStyles() {
  // Remove top site navigation
  safeQueryAll('div.site-bar, header.main, #mega-menu-target, .ct-character-sheet-navigation')
    .forEach(e => e.remove());

  const siteMain = safeQuery('#site-main');
  if (siteMain) siteMain.style['padding-top'] = '0';

  // Remove interactive/unnecessary elements from sections
  safeQueryAll('.ct-subsection-tablet, .ct-main-tablet__large-boxes').forEach(e => {
    e.style['padding'] = '0';
    e.style['margin'] = '0';
  });

  // Clean up character header for high contrast
  const header = safeQuery('.ct-character-tidbits');
  if (header) {
    header.style['background'] = 'white';
    header.style['color'] = 'black';
  }

  const name = safeQuery('.ct-character-tidbits__name');
  if (name) name.style['color'] = 'black';

  const hp = safeQuery('.ct-status-summary-bar__hp-text');
  if (hp) {
    hp.style['color'] = 'black';
    hp.style['font-size'] = '30px';
  }

  // Remove tab navigation after expanding
  safeQueryAll('.ct-character-sheet-navigation__tabs').forEach(e => e.remove());
}

// Execution sequence
appendAllSections();
moveDefenses();
tweakStyles();