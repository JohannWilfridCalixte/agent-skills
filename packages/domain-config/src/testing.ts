import type { Harness } from './model/defaults.js';
import type { ConfigLocation, ConfigStore } from './ports/config-store.js';
import type { ModelCatalog, ModelList } from './ports/model-catalog.js';

const keyOf = (location: ConfigLocation) => (location.kind === 'global' ? 'global' : `project:${location.projectPath}`);

/** Files keyed by location; `set` seeds raw text (any text, valid or not); `failWrites` makes `write` reject. */
export class InMemoryConfigStore implements ConfigStore {
  failWrites = false;
  readonly writes: { readonly location: ConfigLocation; readonly text: string }[] = [];
  private readonly files = new Map<string, string>();

  get(location: ConfigLocation) {
    return this.files.get(keyOf(location));
  }

  read(location: ConfigLocation) {
    const text = this.files.get(keyOf(location));
    return Promise.resolve(text === undefined ? ({ exists: false } as const) : ({ exists: true, text } as const));
  }

  set(location: ConfigLocation, text: string) {
    this.files.set(keyOf(location), text);
    return this;
  }

  write(location: ConfigLocation, text: string) {
    if (this.failWrites) return Promise.reject(new Error('write failed'));
    this.writes.push({ location, text });
    this.files.set(keyOf(location), text);
    return Promise.resolve();
  }
}

/** Model ids per harness; a harness left out is unavailable. */
export class InMemoryModelCatalog implements ModelCatalog {
  private readonly ids: Partial<Record<Harness, readonly string[]>>;

  constructor(ids: Partial<Record<Harness, readonly string[]>> = {}) {
    this.ids = ids;
  }

  models(harness: Harness) {
    const ids = this.ids[harness];
    const list: ModelList = ids === undefined ? { available: false } : { available: true, ids };
    return Promise.resolve(list);
  }
}
