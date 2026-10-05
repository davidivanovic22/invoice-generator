// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';
import { randomUUID } from 'crypto';
import { TextDecoder, TextEncoder } from 'util';

// CRA's jsdom predates these browser APIs; react-router 7, the A4 preview and our id helpers need them.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
Object.assign(globalThis, { TextEncoder, TextDecoder, ResizeObserver: ResizeObserverStub });
if (!globalThis.crypto?.randomUUID) {
  Object.defineProperty(globalThis, 'crypto', {
    value: { ...globalThis.crypto, randomUUID },
    configurable: true
  });
}

beforeEach(() => {
  localStorage.clear();
});
