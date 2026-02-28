export class Queue<T> {
   private _queue: Item<T>[] = [];

   constructor(...items: T[]) {
      this.add(...items);
   }

   add(...items: T[]): void {
      let index = this._queue.length;
      for (const item of items) {
         this._queue.push({ item, index: index++ });
      }
   }

   get length(): number {
      return this._queue.length;
   }

   *shift(): IterableIterator<T> {
      while (this._queue.length) {
         const { item } = this._queue.shift()!;
         yield item;
      }
   }

   *each(): IterableIterator<Item<T>> {
      for (const item of this._queue) {
         yield item;
      }
   }

   get items() {
      return Array.from(this._queue);
   }
}

type Item<T> = { item: T; index: number };
