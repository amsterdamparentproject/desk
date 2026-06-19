import '@testing-library/jest-dom'

// jsdom doesn't implement ResizeObserver; stub it out
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

// jsdom's localStorage is not available in this environment; stub it
const store: Record<string, string> = {}
global.localStorage = {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, value: string) => { store[key] = value },
  removeItem: (key: string) => { delete store[key] },
  clear: () => { Object.keys(store).forEach(k => delete store[k]) },
  key: (i: number) => Object.keys(store)[i] ?? null,
  get length() { return Object.keys(store).length },
} as Storage
