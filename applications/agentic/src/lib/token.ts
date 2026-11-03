/** sessionStorage key: the token lives for the tab only and never reaches localStorage (D28). */
export const TOKEN_STORAGE_KEY = 'agentic.token';
/** sessionStorage key: the project `agentic serve` started in, so pages open on it (AC1). */
export const START_PROJECT_STORAGE_KEY = 'agentic.startProject';

type Browser = Pick<Window, 'history' | 'location' | 'sessionStorage'>;

/**
 * Moves `#token=...` (and the startup `&project=...`) from the URL into sessionStorage and strips the fragment at once
 * (history.replaceState), so the token never stays in the address bar, history or a copied link. Returns the token,
 * or undefined when there is none.
 */
export function captureToken(browser: Browser) {
  const fragment = new URLSearchParams(browser.location.hash.slice(1));
  const fromFragment = fragment.get('token');
  if (fromFragment !== null && fromFragment !== '') {
    browser.sessionStorage.setItem(TOKEN_STORAGE_KEY, fromFragment);
    const project = fragment.get('project');
    if (project !== null && project !== '') browser.sessionStorage.setItem(START_PROJECT_STORAGE_KEY, project);
    browser.history.replaceState(browser.history.state, '', `${browser.location.pathname}${browser.location.search}`);
  }
  return readToken(browser);
}

/** The project id `agentic serve` started in, or undefined. */
export function readStartProject(browser: Pick<Window, 'sessionStorage'>) {
  return browser.sessionStorage.getItem(START_PROJECT_STORAGE_KEY) ?? undefined;
}

export function readToken(browser: Pick<Window, 'sessionStorage'>) {
  return browser.sessionStorage.getItem(TOKEN_STORAGE_KEY) ?? undefined;
}
