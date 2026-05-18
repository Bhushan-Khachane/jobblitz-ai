/**
 * JobBlitz AI — Injected page-context script
 * Runs in the main page context (not extension context).
 * Reserved for future use: reading React/Vue component state,
 * intercepting XHR/fetch calls, or reading SPA route changes.
 */
(function () {
  // Signal to content.js that the injected script is loaded
  window.dispatchEvent(new CustomEvent('jobblitz:ready', { detail: { version: '1.0.0' } }));
})();
