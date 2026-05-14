// Injected on job portal pages — assists background.js with DOM detection
(function() {
  // Notify background when apply confirmation is detected
  const successPatterns = [
    /application (submitted|sent|received)/i,
    /applied successfully/i,
    /thank you for applying/i,
    /your application has been/i
  ];

  const observer = new MutationObserver(() => {
    const text = document.body?.innerText || '';
    for (const pattern of successPatterns) {
      if (pattern.test(text)) {
        chrome.runtime.sendMessage({ type: 'apply_confirmed', url: location.href });
        observer.disconnect();
        break;
      }
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
})();
