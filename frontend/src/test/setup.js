import '@testing-library/jest-dom'

/** Framer Motion (e.g. Landing hero) uses in-view observers; jsdom has none. */
if (typeof globalThis.IntersectionObserver === 'undefined') {
  globalThis.IntersectionObserver = class IntersectionObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}
