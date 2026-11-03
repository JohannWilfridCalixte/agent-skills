import type { VendorFile } from '../model/manifest.js';

/** Reads the vendoring files at a known project root; the domain names the file, never the client. */
export interface VendorSource {
  /** File text, or `undefined` when it does not exist (or is not a readable file). Never rejects. */
  read(projectPath: string, file: VendorFile): Promise<string | undefined>;
}
