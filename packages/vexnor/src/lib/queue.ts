export class Queue<T> {
   private _items: Item<T>[] = [];

   constructor(items?: T[]) {
      if (items?.length) {
         this.push(...items);
      }
   }

   push(...items: T[]): void {
      let index = this._items.length;
      for (const item of items) {
         this._items.push({ item, index: index++ });
      }
   }

   get length(): number {
      return this._items.length;
   }

   *shift(): IterableIterator<T> {
      while (this._items.length) {
         const { item } = this._items.shift()!;
         yield item;
      }
   }

   *pop(): IterableIterator<T> {
      while (this._items.length) {
         const { item } = this._items.pop()!;
         yield item;
      }
   }

   *each(): IterableIterator<Item<T>> {
      for (const item of this._items) {
         yield item;
      }
   }

   get items() {
      return Array.from(this._items);
   }
}

type Item<T> = { item: T; index: number };
