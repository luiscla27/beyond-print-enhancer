/**
 * Global test setup to silence JSDOM noise.
 */
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

console.log = (...args) => {
  const msg = args[0] && typeof args[0] === 'string' ? args[0] : '';
  // Silence various test-only log patterns
  if (msg.includes('Mock Tab Clicked:')) return;
  if (msg.includes('Containers found:')) return;
  if (msg.includes('Body:')) return;
  if (msg.includes('Merges:')) return;
  if (msg.includes('Clone top after update:')) return;
  if (msg.includes('[DDB Print Enhance] Navigating to:')) return;
  if (msg.includes('[DDB Print Enhance] Could not find tab for section:')) return;
  
  const originalConsoleLog = console.log.original || console.log;
  // We need to be careful with recursion if we were to use the original
  // But since we are replacing the global one, we should use a backup
  if (console.log.original) {
    console.log.original(...args);
  } else {
    // If no backup yet, just don't log the silenced ones
  }
};

// Initial setup for log backup
if (!console.log.original) {
  const backup = console.log;
  console.log = (...args) => {
    const msg = args[0] && typeof args[0] === 'string' ? args[0] : '';
    if (msg.includes('Mock Tab Clicked:') || 
        msg.includes('Containers found:') || 
        msg.includes('Body:') || 
        msg.includes('Merges:') || 
        msg.includes('Clone top after update:') ||
        msg.includes('[DDB Print]') ||
        msg.includes('[DDB Print Enhance]')) return;
    backup(...args);
  };
  console.log.original = backup;
}

console.error = (...args) => {
  const msg = args[0] && typeof args[0] === 'string' ? args[0] : '';
  // Silence JSDOM CSS parsing errors
  if (msg.includes('Could not parse CSS stylesheet')) return;
  // Silence IndexedDB errors that are handled but noisy in JSDOM
  if (msg.includes('[DDB Print] Failed to initialize storage')) return;
  if (msg.includes('Critical error opening IndexedDB')) return;
  
  originalConsoleError(...args);
};

console.warn = (...args) => {
  const msg = args[0] && typeof args[0] === 'string' ? args[0] : '';
  // Silence "Default layout target not found" which is expected in unit tests
  if (msg.includes('[DDB Print] Default layout target not found')) return;
  
  originalConsoleWarn(...args);
};
