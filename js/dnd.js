/**
 * Drag and Drop Engine for Print Sections
 */

let draggedItem = null;
let customGhost = null;
let dragOffsetX = 0;
let dragOffsetY = 0;

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
  const target = e.target.closest('.be-section-wrapper');
  if (!target) return;

  console.log('[DDB Print] Drag Start on:', target.id);

  draggedItem = target;
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', target.id);

  // Hide the default browser ghost
  const img = new Image();
  img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
  e.dataTransfer.setDragImage(img, 0, 0);

  // Create custom ghost that perfectly mirrors the source
  const rotation = target.dataset.rotation || '0';
  const rect = target.getBoundingClientRect();
  
  // Calculate offsets based on mouse position relative to wrapper visual bounds
  dragOffsetX = e.clientX - rect.left;
  dragOffsetY = e.clientY - rect.top;

  customGhost = target.cloneNode(true);
  customGhost.classList.add('be-drag-ghost');
  
  // Force reset styles for ghost to ensure it follows the mouse exactly as target appears
  Object.assign(customGhost.style, {
      position: 'fixed',
      pointerEvents: 'none',
      opacity: '0.8',
      zIndex: '99999',
      width: target.offsetWidth + 'px',
      height: target.offsetHeight + 'px',
      transform: `rotate(${rotation}deg)`,
      margin: '0',
      left: '0',
      top: '0',
      willChange: 'left, top, transform',
      visibility: 'visible',
      display: 'block'
  });
  
  // Remove interactive handles from ghost to prevent clutter
  const h = customGhost.querySelector('.be-rotation-handle');
  if (h) h.remove();

  document.body.appendChild(customGhost);
  console.log('[DDB Print] Custom ghost created. Rotation:', rotation, 'Transform:', customGhost.style.transform);
  updateGhostPosition(e);

  target.style.opacity = '0.4';
  target.classList.add('dragging');
}

function updateGhostPosition(e) {
    if (!customGhost) return;
    
    // Smoothly position the ghost
    const x = (e.clientX - dragOffsetX);
    const y = (e.clientY - dragOffsetY);
    
    // Use direct style setting for immediate feedback during drag
    customGhost.style.left = x + 'px';
    customGhost.style.top = y + 'px';
}

function handleDragOver(e) {
  if (e.preventDefault) {
    e.preventDefault();
  }
  e.dataTransfer.dropEffect = 'move';
  
  updateGhostPosition(e);
  
  return false;
}

function handleDragEnter(e) {
  const target = e.target.closest('.be-section-wrapper');
  if (target && target !== draggedItem) {
    target.classList.add('drag-over');
  }
}

function handleDragLeave(e) {
  const target = e.target.closest('.be-section-wrapper');
  if (target && target !== draggedItem) {
    target.classList.remove('drag-over');
  }
}

function handleDrop(e) {
  console.log('[DDB Print] Drop event');
  if (e.stopPropagation) {
    e.stopPropagation();
  }

  const target = e.target.closest('.be-section-wrapper');
  
  if (draggedItem !== target && target) {
    const container = document.getElementById('print-layout-wrapper');
    const rect = target.getBoundingClientRect();
    const next = (e.clientY - rect.top) / (rect.bottom - rect.top) > 0.5;
    
    if (next) {
        container.insertBefore(draggedItem, target.nextSibling);
    } else {
        container.insertBefore(draggedItem, target);
    }
    console.log('[DDB Print] Item moved in DOM');
  }
  
  return false;
}

function handleDragEnd(e) {
  console.log('[DDB Print] Drag End');
  const target = e.target.closest('.be-section-wrapper');
  if (target) {
    target.style.opacity = '1';
    target.classList.remove('dragging');
  }
  
  if (customGhost) {
      console.log('[DDB Print] Removing custom ghost');
      if (customGhost.parentNode) customGhost.parentNode.removeChild(customGhost);
      customGhost = null;
  }
  
  document.querySelectorAll('.be-section-wrapper').forEach(el => {
    el.classList.remove('drag-over');
  });
  
  draggedItem = null;
}

// Add necessary styles dynamically
function injectDnDStyles() {
    const style = document.createElement('style');
    style.id = 'ddb-print-dnd-style';
    style.textContent = `
        .be-section-wrapper {
            transition: transform 0.2s, opacity 0.2s;
        }
        .be-section-wrapper.drag-over {
            border: 2px dashed #000;
        }
        .print-section-header {
            cursor: move;
            cursor: grab;
        }
        .print-section-header:active {
            cursor: grabbing;
        }
        .be-drag-ghost {
            pointer-events: none !important;
            opacity: 0.8 !important;
            box-shadow: 0 5px 15px rgba(0,0,0,0.5) !important;
            transition: none !important;
            background-color: transparent !important;
            border: none !important;
        }
    `;
    document.head.appendChild(style);
}

// Export functions to be called by main.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { initDragAndDrop };
} else {
    // Browser context
    window.initDragAndDrop = initDragAndDrop;
    window.injectDnDStyles = injectDnDStyles;
}
