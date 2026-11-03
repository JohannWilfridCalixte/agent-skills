export interface Err<E> {
  readonly error: E;
  readonly ok: false;
}

export interface Ok<T> {
  readonly ok: true;
  readonly value: T;
}

export type Result<T, E> = Err<E> | Ok<T>;

export const ok = <T>(value: T) => ({ ok: true, value }) as const satisfies Ok<T>;

export const err = <const E>(error: E) => ({ error, ok: false }) as const satisfies Err<E>;

export function andThen<T, E, U, F>(result: Result<T, E>, next: (value: T) => Result<U, F>) {
  return result.ok ? next(result.value) : result;
}

/** Collects every value, or returns the first error. */
export function combine<T, E>(results: readonly Result<T, E>[]) {
  const values: T[] = [];

  for (const result of results) {
    if (!result.ok) return result;
    values.push(result.value);
  }

  return ok<readonly T[]>(values);
}

/** Adapter boundary helper: turns a rejecting promise into an `Err`. */
export async function fromPromise<T, E>(promise: PromiseLike<T>, toError: (cause: unknown) => E) {
  try {
    return ok(await promise);
  } catch (cause) {
    return err(toError(cause));
  }
}

export function map<T, E, U>(result: Result<T, E>, transform: (value: T) => U) {
  return result.ok ? ok(transform(result.value)) : result;
}

export function mapErr<T, E, F>(result: Result<T, E>, transform: (error: E) => F) {
  return result.ok ? result : err(transform(result.error));
}
