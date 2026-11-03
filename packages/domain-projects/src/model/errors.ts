export type AddProjectError = PathNotAbsolute | PathNotDirectory | PathNotFound | ProjectAlreadyKnown;

export interface PathNotAbsolute {
  readonly path: string;
  readonly type: 'path_not_absolute';
}

export interface PathNotDirectory {
  readonly path: string;
  readonly type: 'path_not_directory';
}

export interface PathNotFound {
  readonly path: string;
  readonly type: 'path_not_found';
}

export interface ProjectAlreadyKnown {
  readonly path: string;
  readonly projectId: string;
  readonly type: 'project_already_known';
}

export interface ProjectNotFound {
  readonly id: string;
  readonly type: 'project_not_found';
}
export type RemoveProjectError = ProjectNotFound;
