/**
 * UI Controls for Saving and Managing Layouts
 */

/* eslint-disable no-redeclare */
// In browser context, Storage is likely loaded globally or via a bundler.
/* global Storage:writable */
/* eslint-enable no-redeclare */

function createControls() {
  const container = document.createElement('div');
  container.id = 'print-enhance-controls';
  container.style.position = 'fixed';
  container.style.top = '10px';
  container.style.right = '10px';
  container.style.zIndex = '10000';
  container.style.background = 'white';
  container.style.border = '1px solid black';
  container.style.padding = '10px';
  container.style.display = 'flex';
  container.style.gap = '5px';
  
  // Hide controls when printing
  const style = document.createElement('style');
  style.textContent = '@media print { #print-enhance-controls { display: none !important; } }';
  document.head.appendChild(style);

  const saveBtn = document.createElement('button');
  saveBtn.textContent = 'Save Layout';
  saveBtn.onclick = handleSaveLayout;
  
  const resetBtn = document.createElement('button');
  resetBtn.textContent = 'Reset';
  resetBtn.onclick = () => location.reload(); // Simple reset for now

  container.appendChild(saveBtn);
  container.appendChild(resetBtn);
  
  document.body.appendChild(container);
}

async function handleSaveLayout() {
  // Extract character ID from URL
  const characterId = window.location.pathname.split('/').pop();
  if (!characterId) {
    alert('Could not identify character ID.');
    return;
  }

  // Get current order of sections
  const sections = Array.from(document.querySelectorAll('.print-section-container'));
  const sectionOrder = sections.map(el => el.id);

  // Gather custom spell sections (Phase 4 integration)
  const customSpells = [];
  sections.forEach(el => {
    // Check if it's a custom spell section (has a numeric timestamp in ID and is not the original)
    if (el.id.startsWith('section-spells-')) {
        const content = el.querySelector('.print-section-content') || el.querySelector('.ct-character-sheet-content');
        customSpells.push({
            id: el.id,
            htmlContent: content ? content.innerHTML : '' 
        });
    }
  });

  const data = {
    sectionOrder,
    customSpells
  };

  try {
    // Assuming Storage is globally available via concatenation or window
    if (typeof Storage !== 'undefined') {
        await Storage.init();
        await Storage.saveLayout(characterId, data);
        alert('Layout saved!');
    } else {
        console.error('Storage module not found');
    }
  } catch (err) {
    console.error(err);
    alert('Failed to save layout.');
  }
}

async function restoreLayout() {
  const characterId = window.location.pathname.split('/').pop();
  if (!characterId) return;

  try {
    if (typeof Storage !== 'undefined') {
        await Storage.init();
        const data = await Storage.loadLayout(characterId);
        
        if (data) {
            const container = document.getElementById('print-layout-wrapper');
            
            // Restore custom spells first so they exist for reordering
            if (data.customSpells && data.customSpells.length > 0) {
                // We need a reference original spell container to clone style/structure
                const originalSpells = document.getElementById('section-spells');
                if (originalSpells) {
                    data.customSpells.forEach(spellData => {
                        const clone = originalSpells.cloneNode(true);
                        clone.id = spellData.id;
                        
                        // Setup header
                        const header = clone.querySelector('.print-section-header');
                        if (header) {
                            const oldBtn = header.querySelector('button');
                            if (oldBtn) oldBtn.remove();
                            header.childNodes[0].textContent = 'Prepared Spells';
                            
                            const removeBtn = document.createElement('button');
                            removeBtn.textContent = 'X';
                            removeBtn.style.float = 'right';
                            removeBtn.style.color = 'red';
                            removeBtn.onclick = (e) => {
                                e.stopPropagation();
                                clone.remove();
                            };
                            header.appendChild(removeBtn);
                        }
                        
                        // Restore content
                        const content = clone.querySelector('.print-section-content') || clone.querySelector('.ct-character-sheet-content');
                        if (content) {
                            content.innerHTML = spellData.htmlContent;
                            content.className = 'print-section-content';
                        }
                        
                        container.appendChild(clone);
                    });
                }
            }

            // Reorder all elements based on saved order
            if (data.sectionOrder) {
                data.sectionOrder.forEach(id => {
                    const el = document.getElementById(id);
                    if (el) {
                        container.appendChild(el); // Appending moves it to the end, effectively sorting
                    }
                });
            }
        }
    }
  } catch (err) {
    console.error('Failed to restore layout', err);
  }
}

// Export for Node.js/Test environment if module exists
/* eslint-disable no-undef */
if (typeof module !== 'undefined' && module.exports) {
    // For testing, we might need to mock Storage or inject it
    module.exports = { createControls, restoreLayout };
} else {
    window.createControls = createControls;
    window.restoreLayout = restoreLayout;
}
/* eslint-enable no-undef */
