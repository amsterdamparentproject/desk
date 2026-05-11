import '@testing-library/jest-dom'

// jsdom doesn't implement ResizeObserver; stub it out
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
