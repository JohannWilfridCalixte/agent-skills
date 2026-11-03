import type { Result } from '@agentic/kernel-result';

import type { CancelRunError, InvalidRunSpec, RunEvent, RunNotFound, RunSpec, RunSummary, RunView } from '../model/run.js';

/**
 * Background runs shared by install and vendoring (T10). Runs live in memory (lost on restart; history keeps the
 * outcome), keep going with no subscriber (D27), are never retried, and record one history entry when they end.
 */
export interface RunService {
  cancel(id: string): Result<RunSummary, CancelRunError>;
  get(id: string): Result<RunView, RunNotFound>;
  /** Validates `spec` at runtime too (it may come from parsed input), then starts it. */
  start(spec: RunSpec): Result<RunSummary, InvalidRunSpec>;
  /** Replays every buffered event, then live ones; ends after the final `status` event. */
  subscribe(id: string): Result<AsyncIterable<RunEvent>, RunNotFound>;
}
