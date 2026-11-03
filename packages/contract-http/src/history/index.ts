import { z } from 'zod';

export const HistoryKind = z.enum(['config_write', 'config_restore', 'run']);

export type HistoryKind = z.infer<typeof HistoryKind>;

export const HistoryEntry = z.object({
  /** Full content written, for config kinds; `null` for runs. */
  content: z.string().nullable(),
  createdAt: z.iso.datetime(),
  /** Exit code, for runs; `null` for config kinds. */
  exitCode: z.int().nullable(),
  id: z.string().min(1),
  kind: HistoryKind,
  /** Last 256 KiB of run output; `null` for config kinds. */
  outputTail: z.string().nullable(),
  /** `global` or `project:<id>`. */
  scope: z.string().min(1),
  summary: z.string(),
  truncated: z.boolean(),
});

export type HistoryEntry = z.infer<typeof HistoryEntry>;

export const HistoryList = z.object({
  entries: z.array(HistoryEntry),
});

export type HistoryList = z.infer<typeof HistoryList>;

/** `GET /api/history?scope=&limit=`: entries of one scope, newest first. */
export const HistoryListQuery = z.object({
  limit: z.coerce.number().int().min(1).max(500).optional(),
  scope: z.string().min(1),
});

export type HistoryListQuery = z.infer<typeof HistoryListQuery>;
