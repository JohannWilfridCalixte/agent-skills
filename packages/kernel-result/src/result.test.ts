import type { Result } from './result.js';

import { describe, expect, it } from 'vitest';

import { andThen, combine, err, fromPromise, map, mapErr, ok } from './result.js';

const parsePositive = (value: number) => (value > 0 ? ok(value) : err('not_positive'));

describe('map', () => {
  it('transforms the value of an ok result', () => {
    expect(map(ok(2), (value) => value * 10)).toEqual(ok(20));
  });

  it('leaves an err result untouched', () => {
    expect(map(parsePositive(-1), (value) => value * 10)).toEqual(err('not_positive'));
  });
});

describe('mapErr', () => {
  it('transforms the error of an err result', () => {
    expect(mapErr(parsePositive(-1), (error) => ({ type: error }))).toEqual(err({ type: 'not_positive' }));
  });

  it('leaves an ok result untouched', () => {
    expect(mapErr(parsePositive(3), (error) => ({ type: error }))).toEqual(ok(3));
  });
});

describe('andThen', () => {
  it('chains a computation that can fail', () => {
    expect(andThen(ok(4), (value) => parsePositive(value - 1))).toEqual(ok(3));
  });

  it('returns the error produced by the chained computation', () => {
    expect(andThen(ok(1), (value) => parsePositive(value - 1))).toEqual(err('not_positive'));
  });

  it('skips the chained computation when the first result failed', () => {
    let called = false;

    const result = andThen(parsePositive(0), (value) => {
      called = true;
      return ok(value);
    });

    expect(result).toEqual(err('not_positive'));
    expect(called).toBe(false);
  });
});

describe('combine', () => {
  it('collects all values in order', () => {
    expect(combine([parsePositive(1), parsePositive(2), parsePositive(3)])).toEqual(ok([1, 2, 3]));
  });

  it('returns the first error', () => {
    const results: Result<number, string>[] = [ok(1), err('first'), err('second')];

    expect(combine(results)).toEqual(err('first'));
  });

  it('returns an empty list for no results', () => {
    expect(combine([])).toEqual(ok([]));
  });
});

describe('fromPromise', () => {
  it('wraps a resolved value in ok', async () => {
    expect(await fromPromise(Promise.resolve('done'), () => 'failed')).toEqual(ok('done'));
  });

  it('maps a rejection to err', async () => {
    const result = await fromPromise(Promise.reject(new Error('boom')), (cause) =>
      cause instanceof Error ? cause.message : 'unknown',
    );

    expect(result).toEqual(err('boom'));
  });
});
