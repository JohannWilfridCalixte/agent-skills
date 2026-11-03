/** Looks at the filesystem without changing it; the real one lives in the server module. */
export interface DirectoryProbe {
  kind(path: string): Promise<PathKind>;
}

export type PathKind = 'directory' | 'missing' | 'other';
