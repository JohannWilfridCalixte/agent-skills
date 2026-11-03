export type { GetHistoryEntryError, HistoryEntryNotFound } from './model/errors.js';
export type { OutputTail } from './model/output-tail.js';
export { OUTPUT_TAIL_LIMIT_BYTES, outputTail } from './model/output-tail.js';
export type { HistoryRepository } from './ports/history-repository.js';
export type { HistoryService, HistoryServiceDependencies } from './services/history-service.js';
export { createHistoryService } from './services/history-service.js';
