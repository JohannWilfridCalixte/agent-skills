import type { ProblemDetails } from '@agentic/contract-http/problem';
import type { Result } from '@agentic/kernel-result';

export type ApiError = InvalidBodyApiError | NetworkApiError | ProblemApiError | UnexpectedStatusApiError;

export type ApiResult<T> = Result<T, ApiError>;

/** The response body is not JSON or does not match the contract schema. */
export interface InvalidBodyApiError {
  readonly correlationId: string;
  readonly message: string;
  readonly status: number;
  readonly type: 'invalid_body';
}

/** The request never got a response (server down, aborted, offline). */
export interface NetworkApiError {
  readonly correlationId: string;
  readonly message: string;
  readonly type: 'network';
}

/** The server answered with an RFC 9457 problem document. */
export interface ProblemApiError {
  readonly correlationId: string;
  readonly problem: ProblemDetails;
  readonly status: number;
  readonly type: 'problem';
}

/** The server answered with an error status but no problem document. */
export interface UnexpectedStatusApiError {
  readonly correlationId: string;
  readonly status: number;
  readonly type: 'unexpected_status';
}

/** Thrown only at the TanStack Query boundary, which expects failing query functions to reject. */
export class ApiRequestError extends Error {
  readonly apiError: ApiError;

  constructor(apiError: ApiError) {
    super(describeApiError(apiError).message);
    this.name = 'ApiRequestError';
    this.apiError = apiError;
  }
}

/** What went wrong and what to do next (AC28). */
export function describeApiError(error: ApiError) {
  switch (error.type) {
    case 'invalid_body': {
      return { message: 'The agentic server sent an unexpected response.', nextStep: 'Restart `agentic serve` from the same checkout as this page, then retry.' };
    }
    case 'network': {
      return { message: 'Cannot reach the agentic server.', nextStep: 'Start it with `agentic serve`, then retry.' };
    }
    case 'problem': {
      return { message: error.problem.detail ?? error.problem.title, nextStep: nextStepForStatus(error.status) };
    }
    case 'unexpected_status': {
      return { message: `Request failed with HTTP ${String(error.status)}.`, nextStep: nextStepForStatus(error.status) };
    }
    default: {
      return error satisfies never;
    }
  }
}

export function unwrap<T>(result: ApiResult<T>) {
  if (!result.ok) throw new ApiRequestError(result.error);
  return result.value;
}

function nextStepForStatus(status: number) {
  if (status === 401) return 'Open the URL printed by `agentic serve` to get a fresh token.';
  if (status >= 500) return 'Check the `agentic serve` output, then retry.';
  return 'Fix the request and try again.';
}
