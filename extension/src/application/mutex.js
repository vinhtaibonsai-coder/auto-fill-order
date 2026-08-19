(() => {
  const locks = new Set();

  const Mutex = {
    async acquire(lockName) {
      if (locks.has(lockName)) {
        return false;
      }
      locks.add(lockName);
      return true;
    },

    release(lockName) {
      locks.delete(lockName);
    },

    isLocked(lockName) {
      return locks.has(lockName);
    }
  };

  globalThis.Mutex = Mutex;
})();
