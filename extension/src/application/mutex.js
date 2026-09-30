(() => {
  const locks = new Map();

  const Mutex = {
    async acquire(lockName, timeoutMs = 8000) {
      const now = Date.now();
      if (locks.has(lockName)) {
        const lockTime = locks.get(lockName);
        if (now - lockTime > timeoutMs) {
          console.warn(`[Mutex] Khóa "${lockName}" bị giữ quá ${timeoutMs}ms, tự động giải phóng.`);
          locks.delete(lockName);
        } else {
          return false;
        }
      }
      locks.set(lockName, now);
      return true;
    },

    release(lockName) {
      locks.delete(lockName);
    },

    isLocked(lockName, timeoutMs = 8000) {
      if (!locks.has(lockName)) return false;
      const now = Date.now();
      if (now - locks.get(lockName) > timeoutMs) {
        locks.delete(lockName);
        return false;
      }
      return true;
    }
  };

  globalThis.Mutex = Mutex;
})();
