const SLUG = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const REVIEW_FILE = /^[A-Za-z0-9._-]+\.md$/;
const REVIEWS_PREFIX = 'reviews/';

/** Top-level markdown docs a client may read, each `<name>.md` (D31). */
export const DOC_NAMES = ['input', 'context', 'decisions', 'spec', 'plan', 'implementation', 'diagnosis', 'pr'] as const;

export type BaseDocName = (typeof DOC_NAMES)[number];

/** A validated doc: its client-facing `name` and its file relative to the item folder. */
export interface DocRef {
  readonly file: string;
  readonly name: string;
}

/** A work-item folder name: no slashes, no leading dot or underscore, no `..`. */
export function isValidSlug(slug: string) {
  return SLUG.test(slug) && !slug.includes('..');
}

const isBaseDocName = (name: string): name is BaseDocName => (DOC_NAMES as readonly string[]).includes(name);

/** The doc name of a file listed in an item, or `undefined` when it is not a readable doc. */
export function docNameOfFile(file: string) {
  const name = file.startsWith(REVIEWS_PREFIX) ? file : file.replace(/\.md$/, '');
  return parseDocName(name)?.file === file ? name : undefined;
}

/** `spec` → `spec.md`; `reviews/<file>.md` → itself; anything else (paths, `..`, other files) → `undefined`. */
export function parseDocName(name: string) {
  if (isBaseDocName(name)) return { file: `${name}.md`, name } satisfies DocRef;
  if (!name.startsWith(REVIEWS_PREFIX)) return undefined;
  const reviewFile = name.slice(REVIEWS_PREFIX.length);
  if (!REVIEW_FILE.test(reviewFile) || reviewFile.includes('..')) return undefined;
  return { file: name, name } satisfies DocRef;
}
