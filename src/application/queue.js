(() => {
  class PromiseQueue {
    constructor(maxConcurrency = 2) {
      this.maxConcurrency = maxConcurrency;
      this.running = 0;
      this.queue = [];
    }

    add(promiseCreator) {
      return new Promise((resolve, reject) => {
        this.queue.push({ promiseCreator, resolve, reject });
        this.next();
      });
    }

    next() {
      if (this.running >= this.maxConcurrency || this.queue.length === 0) {
        return;
      }

      this.running++;
      const { promiseCreator, resolve, reject } = this.queue.shift();

      promiseCreator()
        .then(resolve)
        .catch(reject)
        .finally(() => {
          this.running--;
          this.next();
        });
    }
  }

  globalThis.PromiseQueue = PromiseQueue;
})();
