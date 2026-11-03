/** Unbounded push queue consumed as a single-reader async iterable. */
export class EventQueue<T> implements AsyncIterable<T> {
  private closed = false;
  private readonly items: T[] = [];
  private waiter: (() => void) | undefined;

  close() {
    this.closed = true;
    this.wake();
  }

  push(item: T) {
    this.items.push(item);
    this.wake();
  }

  async* [Symbol.asyncIterator]() {
    for (;;) {
      const item = this.items.shift();
      if (item !== undefined) {
        yield item;
        continue;
      }
      if (this.closed) return;
      await new Promise<void>((resolve) => {
        this.waiter = resolve;
      });
    }
  }

  private wake() {
    const waiter = this.waiter;
    this.waiter = undefined;
    waiter?.();
  }
}

/** Splits decoded chunks into lines; `flush` returns the unterminated rest. */
export class LineSplitter {
  private pending = '';

  flush() {
    const rest = this.pending;
    this.pending = '';
    return rest === '' ? [] : [rest];
  }

  push(chunk: string) {
    const parts = (this.pending + chunk).split(/\r?\n/);
    this.pending = parts.pop() ?? '';
    return parts;
  }
}
