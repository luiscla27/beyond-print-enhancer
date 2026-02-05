function removeSearchBoxes() {
  // Select various search inputs and filters across the extracted sections
  const searchSelectors = [
    '.ct-spells-filter',
    '.ct-equipment__filter',
    '.ct-filter-box', // General filter box if present
    'input[type="search"]',
    '.ct-application-group__filter'
  ];

  safeQueryAll(searchSelectors.join(', ')).forEach(el => {
    // Check if it's inside one of our print sections to be safe, or just remove global ones
    // given the goal is a print view.
    el.remove();
  });
}

function enforceFullHeight() {
  // Inject CSS to override scrollbars and force height
  const style = document.createElement('style');
  style.id = 'print-enhance-styles';
  style.textContent = `
    .ct-character-sheet-content, 
    .ct-component-carousel,
    .print-section-content {
      overflow: visible !important;
      max-height: none !important;
      height: auto !important;
    }
    
    /* Hide scrollbars explicitly */
    ::-webkit-scrollbar {
        display: none;
    }

    /* Print Specifics */
    @media print {
        @page {
            size: letter;
            margin: 0.5in;
        }
        
        body {
            /* Ensure background graphics are printed if the user enables that option, 
               but otherwise keep it clean */
            -webkit-print-color-adjust: exact; 
        }

        .print-section-container {
            break-inside: avoid; /* Prevent headers separating from content */
            page-break-inside: avoid;
            margin-bottom: 20px;
            border: 1px solid #ccc;
        }
    }
  `;
  document.head.appendChild(style);
}
