(() => {
  async function fetchWithRetry(url, options = {}, retries = 3, delay = 1000) {
    for (let i = 0; i < retries; i++) {
      try {
        const response = await fetch(url, options);
        if (response.ok) return response;
        if (response.status >= 500 || response.status === 429) {
          // Thử lại nếu lỗi Server hoặc lỗi Rate Limit
          await new Promise(res => setTimeout(res, delay * (i + 1)));
          continue;
        }
        return response;
      } catch (err) {
        if (i === retries - 1) throw err;
        await new Promise(res => setTimeout(res, delay * (i + 1)));
      }
    }
    throw new Error(`Đã thử ${retries} lần nhưng không thành công.`);
  }

  globalThis.fetchWithRetry = fetchWithRetry;
})();
