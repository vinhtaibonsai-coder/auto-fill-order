export function createAsyncResultGate() {
  let generation = 0;

  return Object.freeze({
    begin() {
      generation += 1;
      return generation;
    },
    invalidate() {
      generation += 1;
    },
    isCurrent(token) {
      return token === generation;
    }
  });
}
