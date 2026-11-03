/** A folder the user registered; `path` is absolute and unique. */
export interface Project {
  readonly createdAt: string;
  readonly id: string;
  readonly path: string;
}
