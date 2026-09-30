(() => {
  function waitForElement(selector, timeout = 5000) {
    if (typeof document === 'undefined') {
      return Promise.reject(new Error("document is not defined in this context"));
    }
    return new Promise((resolve, reject) => {
      const el = document.querySelector(selector);
      if (el) return resolve(el);

      const root = document.body || document.documentElement || document;
      const observer = new MutationObserver(() => {
        const target = document.querySelector(selector);
        if (target) {
          resolve(target);
          observer.disconnect();
          clearTimeout(timer);
        }
      });

      observer.observe(root, { childList: true, subtree: true });

      const timer = setTimeout(() => {
        observer.disconnect();
        reject(new Error(`Timeout waiting for selector: ${selector}`));
      }, timeout);
    });
  }

  globalThis.waitForElement = waitForElement;
})();
