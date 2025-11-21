export class Queue<T> {
   private _queue: T[] = [];

   constructor(...items: T[]) {
      this._queue.push(...items);
   }

   add(...items: T[]): void {
      this._queue.push(...items);
   }

   get length(): number {
      return this._queue.length;
   }

   *shift(): IterableIterator<T> {
      while (this._queue.length) {
         yield this._queue.shift()!;
      }
   }
}
