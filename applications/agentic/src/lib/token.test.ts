import { describe, expect, it } from 'vitest';

import { captureToken } from './token';

function browserAt(url: string) {
  window.history.replaceState(null, '', url);
  return window;
}

describe('captureToken', () => {
  it('reads the token from the URL fragment into sessionStorage', () => {
    const token = captureToken(browserAt('/projects#token=abc123'));

    expect(token).toBe('abc123');
    expect(sessionStorage.getItem('agentic.token')).toBe('abc123');
  });

  it('removes the fragment from the URL, keeping path and query', () => {
    captureToken(browserAt('/projects?tab=1#token=abc123'));

    expect(`${window.location.pathname}${window.location.search}${window.location.hash}`).toBe('/projects?tab=1');
  });

  it('never stores the token in localStorage', () => {
    captureToken(browserAt('/#token=abc123'));

    expect(localStorage.length).toBe(0);
  });

  it('keeps the token from sessionStorage when the URL has none', () => {
    sessionStorage.setItem('agentic.token', 'stored');

    expect(captureToken(browserAt('/config'))).toBe('stored');
  });

  it('returns undefined when there is no token anywhere', () => {
    expect(captureToken(browserAt('/'))).toBeUndefined();
  });
});
