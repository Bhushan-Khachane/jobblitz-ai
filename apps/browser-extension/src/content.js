/**
 * JobBlitz AI — Content script
 * Runs on every job portal page at document_idle.
 * Responsibilities:
 *   1. Listen for jobblitz:ready event from injected.js
 *   2. Watch for apply confirmation text (MutationObserver)
 *   3. Report confirmations back to background.js
 */
(function () {
  // ── 1. Inject page-context script ──────────────────────────────────────
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('src/injected.js');
  script.onload = () => script.remove();
  (document.head || document.documentElement).appendChild(script);

  // ── 2. Listen for injected script ready signal ──────────────────────────
  window.addEventListener('jobblitz:ready', (e) => {
    console.debug('[JobBlitz] Injected script ready:', e.detail);
  });

  // ── 3. Watch for apply confirmation text (success detection) ───────────
  const SUCCESS_PATTERNS = [
    /application (submitted|sent|received)/i,
    /applied successfully/i,
    /thank you for applying/i,
    /your application has been/i,
    /we've received your application/i,
    /application complete/i,
  ];

  let confirmed = false;

  const observer = new MutationObserver(() => {
    if (confirmed) return;
    const text = document.body?.innerText || '';
    for (const pattern of SUCCESS_PATTERNS) {
      if (pattern.test(text)) {
        confirmed = true;
        observer.disconnect();
        chrome.runtime.sendMessage({
          type: 'apply_confirmed',
          url: location.href,
          timestamp: new Date().toISOString(),
        });
        break;
      }
    }
  });

  if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true });
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      observer.observe(document.body, { childList: true, subtree: true });
    });
  }
})();
