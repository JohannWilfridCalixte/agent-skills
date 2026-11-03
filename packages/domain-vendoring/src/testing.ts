import type { VendorFile } from './model/manifest.js';
import type { VendorSource } from './ports/vendor-source.js';

/** Vendoring files held in memory: `projectPath -> file -> text`. */
export class InMemoryVendorSource implements VendorSource {
  private readonly files = new Map<string, string>();

  read(projectPath: string, file: VendorFile) {
    return Promise.resolve(this.files.get(`${projectPath}\u0000${file}`));
  }

  set(projectPath: string, file: VendorFile, text: string) {
    this.files.set(`${projectPath}\u0000${file}`, text);
    return this;
  }
}
