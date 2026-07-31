export interface Store<T> {
  getState(): T;
  setState(updater: (prev: T) => T): void;
  subscribe(listener: (state: T, prev: T) => void): () => void;
}

export function createStore<T>(initial: T): Store<T> {
  let state = initial;
  const listeners = new Set<(state: T, prev: T) => void>();

  return {
    getState: () => state,
    setState: (updater) => {
      const prev = state;
      const next = updater(prev);
      if (next === prev) return;
      state = next;
      for (const listener of listeners) listener(state, prev);
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export type DiffListener<T> = (state: T, prev: T) => void;

export function diffSubscribe<T extends object>(
  store: Store<T>,
  selector: (state: T) => unknown,
  listener: DiffListener<T>,
): () => void {
  let lastValue = selector(store.getState());
  return store.subscribe((state, prev) => {
    const nextValue = selector(state);
    if (Object.is(nextValue, lastValue)) return;
    lastValue = nextValue;
    listener(state, prev);
  });
}
