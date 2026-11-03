export type GetHistoryEntryError = HistoryEntryNotFound;

export interface HistoryEntryNotFound {
  readonly id: string;
  readonly type: 'history_entry_not_found';
}
