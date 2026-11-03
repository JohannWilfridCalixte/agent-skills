export interface DocNotFound {
  readonly name: string;
  readonly type: 'doc_not_found';
}

export interface InvalidDocName {
  readonly name: string;
  readonly type: 'invalid_doc_name';
}

export interface InvalidSlug {
  readonly slug: string;
  readonly type: 'invalid_slug';
}

export type ListWorkItemsError = WorkItemsProjectNotFound;

export type WorkItemDetailError = InvalidSlug | WorkItemNotFound | WorkItemsProjectNotFound;

export type WorkItemDocError = DocNotFound | InvalidDocName | WorkItemDetailError;
export interface WorkItemNotFound {
  readonly slug: string;
  readonly type: 'work_item_not_found';
}
export interface WorkItemsProjectNotFound {
  readonly projectId: string;
  readonly type: 'project_not_found';
}
