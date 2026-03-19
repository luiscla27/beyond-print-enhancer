/**
 * Drag and Drop Engine for Print Sections
 * Handles absolute positioning with grid snapping and custom ghost mirroring.
 */

const safeLog = window.safeLog || ((method, ...args) => console[method](...args));

let draggedItem = null;
let customGhost = null;
let dragOffsetX = 0;
let dragOffsetY = 0;

/**
 * Initializes Drag and Drop listeners on the layout wrapper.
 */
function initDragAndDrop() {
  const container = document.getElementById('print-layout-wrapper');
  if (!container) {
      safeLog('log', '[DDB Print] DnD Init Failed: container not found');
      return;
  }

  // Clear any existing listeners by cloning the node (if needed, but usually we just want to avoid double init)
  // For this extension, we'll just attach once.
  
  container.addEventListener('dragstart', handleDragStart);
  container.addEventListener('dragover', handleDragOver);
  container.addEventListener('dragenter', handleDragEnter);
  container.addEventListener('dragleave', handleDragLeave);
  container.addEventListener('drop', handleDrop);
  container.addEventListener('dragend', handleDragEnd);
  
  safeLog('log', '[DDB Print] Drag and Drop Engine Initialized on:', container.id);
}

function handleDragStart(e) {
  const target = e.target.closest('.be-section-wrapper');
  if (!target) {
      safeLog('log', '[DDB Print] Drag Start ignored: no .be-section-wrapper found for target:', e.target);
      return;
  }

  safeLog('log', '[DDB Print] Drag Start on:', target.id);

  draggedItem = target;
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', target.id);

  // Hide the default browser ghost
  const img = new Image();
  img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
  e.dataTransfer.setDragImage(img, 0, 0);

  // Calculate visual offsets for the ghost (viewport relative)
  const rect = target.getBoundingClientRect();
  dragOffsetX = e.clientX - rect.left;
  dragOffsetY = e.clientY - rect.top;
  
  safeLog('log', '[DDB Print] Drag Offsets:', dragOffsetX, dragOffsetY);

  // Create custom ghost that perfectly mirrors the source
  customGhost = target.cloneNode(true);
  customGhost.classList.add('be-drag-ghost');
  
  // Force styles for ghost. 
  // IMPORTANT: Use setProperty with 'important' to override any inherited inline styles from the clone.
  customGhost.style.setProperty('position', 'fixed', 'important');
  customGhost.style.setProperty('pointer-events', 'none', 'important');
  customGhost.style.setProperty('opacity', '0.7', 'important');
  customGhost.style.setProperty('z-index', '100000', 'important');
  customGhost.style.setProperty('width', target.offsetWidth + 'px', 'important');
  customGhost.style.setProperty('height', target.offsetHeight + 'px', 'important');
  customGhost.style.setProperty('margin', '0', 'important');
  customGhost.style.setProperty('visibility', 'visible', 'important');
  customGhost.style.setProperty('display', 'block', 'important');
  
  // Ensure the ghost has the same rotation as the target
  const rotation = target.dataset.rotation || '0';
  const ghostContainer = customGhost.querySelector('.be-shape-container') || customGhost.querySelector('.print-section-container');
  if (ghostContainer) {
      ghostContainer.style.setProperty('transform', `rotate(${rotation}deg)`, 'important');
  }

  // Remove interactive handles from ghost
  const handles = customGhost.querySelectorAll('.be-rotation-handle, .print-section-resize-handle');
  handles.forEach(h => h.remove());

  document.body.appendChild(customGhost);
  updateGhostPosition(e);

  target.style.opacity = '0.4';
  target.classList.add('dragging');
}

function updateGhostPosition(e) {
    if (!customGhost) return;
    
    // Ghost is position: fixed, so use clientX/Y directly
    const x = e.clientX - dragOffsetX;
    const y = e.clientY - dragOffsetY;
    
    customGhost.style.setProperty('left', x + 'px', 'important');
    customGhost.style.setProperty('top', y + 'px', 'important');
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
  safeLog('log', '[DDB Print] Drop Event triggered');
  if (e.preventDefault) {
    e.preventDefault();
  }
  if (e.stopPropagation) {
    e.stopPropagation();
  }

  if (draggedItem) {
    const container = document.getElementById('print-layout-wrapper');
    const containerRect = container.getBoundingClientRect();
    
    // Detect scale from transform (e.g. "scale(0.68)")
    let scale = 1;
    const transform = window.getComputedStyle(container).transform;
    if (transform && transform !== 'none') {
        const values = transform.split('(')[1].split(')')[0].split(',');
        scale = parseFloat(values[0]);
    }

    // Calculate new position relative to the container
    let x = (e.clientX - containerRect.left - dragOffsetX) / scale;
    let y = (e.clientY - containerRect.top - dragOffsetY) / scale;

    // Grid snap (16px)
    x = Math.round(x / 16) * 16;
    y = Math.round(y / 16) * 16;

    safeLog('log', `[DDB Print] Dropping at: ${x}, ${y} (scale: ${scale})`);

    draggedItem.style.setProperty('left', x + 'px', 'important');
    draggedItem.style.setProperty('top', y + 'px', 'important');
    draggedItem.style.margin = '0';
    
    if (window.updateLayoutBounds) {
        window.updateLayoutBounds();
    }
  } else {
      safeLog('log', '[DDB Print] Drop failed: no draggedItem');
  }
  
  return false;
}

function handleDragEnd(e) {
  safeLog('log', '[DDB Print] Drag End');
  if (draggedItem) {
    draggedItem.style.opacity = '1';
    draggedItem.classList.remove('dragging');
  }
  
  if (customGhost) {
      if (customGhost.parentNode) customGhost.parentNode.removeChild(customGhost);
      customGhost = null;
  }
  
  document.querySelectorAll('.be-section-wrapper').forEach(el => {
    el.classList.remove('drag-over');
  });
  
  draggedItem = null;
}

/**
 * Injects necessary styles for the Drag and Drop system.
 */
function injectDnDStyles() {
    const style = document.createElement('style');
    style.id = 'ddb-print-dnd-style';
    style.textContent = `
        .be-section-wrapper.dragging {
            opacity: 0.4 !important;
        }
        .be-section-wrapper.drag-over {
            outline: 2px dashed #28a745 !important;
            outline-offset: 2px;
        }
        .be-drag-ghost {
            pointer-events: none !important;
            box-shadow: 0 10px 25px rgba(0,0,0,0.3) !important;
            background-color: rgba(255, 255, 255, 0.9) !important;
            border: 1px solid #ccc !important;
        }
    `;
    document.head.appendChild(style);
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { initDragAndDrop, injectDnDStyles };
} else {
    window.initDragAndDrop = initDragAndDrop;
    window.injectDnDStyles = injectDnDStyles;
}
