/**
 * Drag and Drop Engine for Print Sections
 */

let draggedItem = null;

function initDragAndDrop() {
  const container = document.getElementById('print-layout-wrapper');
  if (!container) return;

  // Delegate events to the container
  container.addEventListener('dragstart', handleDragStart);
  container.addEventListener('dragover', handleDragOver);
  container.addEventListener('dragenter', handleDragEnter);
  container.addEventListener('dragleave', handleDragLeave);
  container.addEventListener('drop', handleDrop);
  container.addEventListener('dragend', handleDragEnd);
}

function handleDragStart(e) {
  const target = e.target.closest('.print-section-container');
  if (!target) return;

  draggedItem = target;
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', target.id); // Required for Firefox
  
  target.style.opacity = '0.4';
  target.classList.add('dragging');
}

function handleDragOver(e) {
  if (e.preventDefault) {
    e.preventDefault(); // Necessary. Allows us to drop.
  }
  e.dataTransfer.dropEffect = 'move';
  return false;
}

function handleDragEnter(e) {
  const target = e.target.closest('.print-section-container');
  if (target && target !== draggedItem) {
    target.classList.add('drag-over');
  }
}

function handleDragLeave(e) {
  const target = e.target.closest('.print-section-container');
  if (target && target !== draggedItem) {
    target.classList.remove('drag-over');
  }
}

function handleDrop(e) {
  if (e.stopPropagation) {
    e.stopPropagation(); // Stops some browsers from redirecting.
  }

  const target = e.target.closest('.print-section-container');
  
  if (draggedItem !== target && target) {
    const container = document.getElementById('print-layout-wrapper');
    // Determine insert direction based on mouse position relative to target center
    const rect = target.getBoundingClientRect();
    const next = (e.clientY - rect.top) / (rect.bottom - rect.top) > 0.5;
    
    if (next) {
        container.insertBefore(draggedItem, target.nextSibling);
    } else {
        container.insertBefore(draggedItem, target);
    }
  }
  
  return false;
}

function handleDragEnd(e) {
  const target = e.target.closest('.print-section-container');
  if (target) {
    target.style.opacity = '1';
    target.classList.remove('dragging');
  }
  
  document.querySelectorAll('.print-section-container').forEach(el => {
    el.classList.remove('drag-over');
  });
  
  draggedItem = null;
}

// Add necessary styles dynamically
function injectDnDStyles() {
    const style = document.createElement('style');
    style.textContent = `
        .print-section-container {
            transition: transform 0.2s, opacity 0.2s;
        }
        .print-section-container.drag-over {
            border: 2px dashed #000;
        }
        .print-section-header {
            cursor: move; /* Fallback */
            cursor: grab;
        }
        .print-section-header:active {
            cursor: grabbing;
        }
    `;
    document.head.appendChild(style);
}

// Export functions to be called by main.js
// In a real module system, we'd export. For now, we rely on global scope injection or concatenation.
// We'll attach to window for testing/access if needed, or just assume concatenation.
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { initDragAndDrop };
} else {
    // Browser context
    window.initDragAndDrop = initDragAndDrop;
    window.injectDnDStyles = injectDnDStyles;
}
