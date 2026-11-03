import { err, ok } from '@agentic/kernel-result';

export interface MalformedVendorFile {
  readonly file: VendorFile;
  readonly reason: string;
  readonly type: 'malformed_vendor_file';
}

/** A skill (or single upstream file) listed in `vendor.json`, with the ref pinned in `vendor.lock.json`. */
export interface VendoredSkill {
  readonly name: string;
  /** `null` when not pinned yet (no lock entry). */
  readonly ref: null | string;
  readonly source: string;
}

export type VendorFile = 'vendor.json' | 'vendor.lock.json';

/** Names the script accepts and the server may pass as an argument: never an option or a path. */
export const SKILL_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> => typeof value === 'object' && value !== null && !Array.isArray(value);

const malformed = (file: VendorFile, reason: string) => err({ file, reason, type: 'malformed_vendor_file' } satisfies MalformedVendorFile);

/** Parses `vendor.json` (and the optional lock) text; any malformed shape is a typed error, never a throw. */
export function parseManifest(manifestText: string, lockText: string | undefined) {
  const parsed = parseJson(manifestText);
  if (!parsed.ok) return malformed('vendor.json', parsed.error);
  const entries = isRecord(parsed.value) ? parsed.value['skills'] : undefined;
  if (!Array.isArray(entries)) return malformed('vendor.json', 'skills must be an array');
  const skills = entries.map(entryOf);
  const invalid = skills.findIndex((skill) => skill === undefined);
  if (invalid !== -1) return malformed('vendor.json', `skills[${String(invalid)}] needs a safe skill or name and a source`);
  const refs = lockRefs(lockText);
  if (!refs.ok) return refs;
  return ok(skills.filter((skill) => skill !== undefined).map((skill): VendoredSkill => ({ ...skill, ref: refs.value.get(skill.name) ?? null })));
}

/** Entry key as the script computes it: `skill` for skill entries, `name` for file entries. */
function entryOf(value: unknown) {
  if (!isRecord(value)) return undefined;
  const name = value['skill'] ?? value['name'];
  const source = value['source'];
  if (typeof name !== 'string' || typeof source !== 'string' || !SKILL_NAME.test(name)) return undefined;
  return { name, source };
}

function lockRefs(lockText: string | undefined) {
  if (lockText === undefined) return ok(new Map<string, string>());
  const parsed = parseJson(lockText);
  if (!parsed.ok) return malformed('vendor.lock.json', parsed.error);
  const skills = isRecord(parsed.value) ? parsed.value['skills'] : undefined;
  if (!isRecord(skills)) return malformed('vendor.lock.json', 'skills must be an object');
  const refs = new Map<string, string>();
  for (const [name, entry] of Object.entries(skills)) {
    if (isRecord(entry) && typeof entry['ref'] === 'string') refs.set(name, entry['ref']);
  }
  return ok(refs);
}

function parseJson(text: string) {
  try {
    return ok(JSON.parse(text) as unknown);
  } catch (error) {
    return err(error instanceof Error ? error.message : String(error));
  }
}
