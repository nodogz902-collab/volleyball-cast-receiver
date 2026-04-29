import { describe, it, expect } from 'vitest';

describe('smoke', () => {
  it('happy-dom environment works', () => {
    document.body.innerHTML = '<div id="app">x</div>';
    expect(document.getElementById('app').textContent).toBe('x');
  });
});
