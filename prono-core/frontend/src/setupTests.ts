import '@testing-library/jest-dom';

// Node 22+ defines global `localStorage`/`sessionStorage` getters that throw
// without `--localstorage-file`. Because they already exist on `global`,
// vitest's jsdom environment setup (which only overrides keys absent from
// `global`) skips patching them, so Node's throwing getters shadow jsdom's
// real window-scoped storage. vitest exposes the underlying JSDOM instance as
// `globalThis.jsdom`; reach its window from there and redefine the globals to
// proxy it.
const jsdomWindow = (globalThis as unknown as { jsdom: { window: Window } }).jsdom.window;
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  get: () => jsdomWindow.localStorage,
});
Object.defineProperty(globalThis, 'sessionStorage', {
  configurable: true,
  get: () => jsdomWindow.sessionStorage,
});
