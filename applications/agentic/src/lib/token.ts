/** sessionStorage key: the token lives for the tab only and never reaches localStorage (D28). */
export const TOKEN_STORAGE_KEY = 'agentic.token';

type Browser = Pick<Window, 'history' | 'location' | 'sessionStorage'>;

/**
 * Moves `#token=...` from the URL into sessionStorage and strips the fragment at once (history.replaceState), so the
 * token never stays in the address bar, history or a copied link. Returns the token, or undefined when there is none.
 */
export function captureToken(browser: Browser) {
  const fromFragment = new URLSearchParams(browser.location.hash.slice(1)).get('token');
  if (fromFragment !== null && fromFragment !== '') {
    browser.sessionStorage.setItem(TOKEN_STORAGE_KEY, fromFragment);
    browser.history.replaceState(browser.history.state, '', `${browser.location.pathname}${browser.location.search}`);
  }
  return readToken(browser);
}

export function readToken(browser: Pick<Window, 'sessionStorage'>) {
  return browser.sessionStorage.getItem(TOKEN_STORAGE_KEY) ?? undefined;
}
