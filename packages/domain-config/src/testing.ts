import type { ConfigLocation, ConfigStore } from './ports/config-store.js';

const keyOf = (location: ConfigLocation) => (location.kind === 'global' ? 'global' : `project:${location.projectPath}`);

/** Files keyed by location; `set` seeds raw text (any text, valid or not). */
export class InMemoryConfigStore implements ConfigStore {
  private readonly files = new Map<string, string>();

  read(location: ConfigLocation) {
    const text = this.files.get(keyOf(location));
    return Promise.resolve(text === undefined ? ({ exists: false } as const) : ({ exists: true, text } as const));
  }

  set(location: ConfigLocation, text: string) {
    this.files.set(keyOf(location), text);
    return this;
  }
}
