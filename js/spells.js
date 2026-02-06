/**
 * Logic for Spell Section Duplication and Management
 */

/* eslint-disable no-undef */

function initSpellDuplication() {
  const spellContainer = document.getElementById('section-spells');
  if (!spellContainer) return; // Might not exist if user has no spells

  const header = spellContainer.querySelector('.print-section-header');
  if (header) {
    const btn = document.createElement('button');
    btn.textContent = '+ Duplicate';
    btn.style.float = 'right';
    btn.style.fontSize = '0.8em';
    btn.style.marginLeft = '10px';
    btn.onclick = (e) => {
        e.stopPropagation(); // Prevent drag start
        duplicateSpellsSection(spellContainer);
    };
    header.appendChild(btn);
  }
}

function duplicateSpellsSection(originalContainer) {
  const clone = originalContainer.cloneNode(true);
  const timestamp = Date.now();
  const newId = `section-spells-${timestamp}`;
  
  clone.id = newId;
  
  // Update header text
  const header = clone.querySelector('.print-section-header');
  if (header) {
    // Remove the old button from the clone first to avoid duplication
    const oldBtn = header.querySelector('button');
    if (oldBtn) oldBtn.remove();
    
    header.childNodes[0].textContent = 'Prepared Spells'; // Reset text
    
    // Add remove button instead of duplicate button
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

  // Clear content to make it an empty template
  const content = clone.querySelector('.print-section-content') || clone.querySelector('.ct-character-sheet-content');
  if (content) {
    content.innerHTML = '<div style="padding:10px; color:#666; font-style:italic;">Empty Spell List (Drag/Drop or Fill Manually)</div>';
    content.className = 'print-section-content'; // Normalize class if it wasn't already
  }

  // Insert after the original
  originalContainer.parentNode.insertBefore(clone, originalContainer.nextSibling);
}

// Export for integration
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { initSpellDuplication };
} else {
    window.initSpellDuplication = initSpellDuplication;
}
/* eslint-enable no-undef */