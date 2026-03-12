import { describe, it, expect } from "vitest";
import { Queue } from "#/lib/queue.js";

describe("Queue", () => {
   describe("constructor", () => {
      it("should create empty queue", () => {
         const queue = new Queue<number>();
         expect(queue.length).toBe(0);
      });

      it("should initialize with items", () => {
         const queue = new Queue([1, 2, 3]);
         expect(queue.length).toBe(3);
      });
   });

   describe("add", () => {
      it("should add single item", () => {
         const queue = new Queue<number>();
         queue.add(1);
         expect(queue.length).toBe(1);
      });

      it("should add multiple items", () => {
         const queue = new Queue<number>();
         queue.add(1, 2, 3);
         expect(queue.length).toBe(3);
      });

      it("should append to existing items", () => {
         const queue = new Queue([1, 2]);
         queue.add(3, 4);
         expect(queue.length).toBe(4);
      });
   });

   describe("length", () => {
      it("should return correct length", () => {
         const queue = new Queue([1, 2, 3]);
         expect(queue.length).toBe(3);
      });

      it("should update after add", () => {
         const queue = new Queue<number>();
         expect(queue.length).toBe(0);
         queue.add(1);
         expect(queue.length).toBe(1);
      });
   });

   describe("shift", () => {
      it("should yield items in FIFO order", () => {
         const queue = new Queue([1, 2, 3]);
         const result = [...queue.shift()];
         expect(result).toEqual([1, 2, 3]);
      });

      it("should drain the queue", () => {
         const queue = new Queue([1, 2, 3]);
         // eslint-disable-next-line @typescript-eslint/no-unused-expressions
         [...queue.shift()];
         expect(queue.length).toBe(0);
      });

      it("should handle empty queue", () => {
         const queue = new Queue<number>();
         const result = [...queue.shift()];
         expect(result).toEqual([]);
      });

      it("should work with for...of loop", () => {
         const queue = new Queue([1, 2, 3]);
         const result: number[] = [];
         for (const item of queue.shift()) {
            result.push(item);
         }
         expect(result).toEqual([1, 2, 3]);
         expect(queue.length).toBe(0);
      });

      it("should allow partial iteration", () => {
         const queue = new Queue([1, 2, 3, 4, 5]);
         const iterator = queue.shift();
         expect(iterator.next().value).toBe(1);
         expect(iterator.next().value).toBe(2);
         expect(queue.length).toBe(3);
      });

      it("should handle items added during iteration", () => {
         const queue = new Queue([1, 2]);
         const iterator = queue.shift();
         expect(iterator.next().value).toBe(1);
         queue.add(3);
         expect(iterator.next().value).toBe(2);
         expect(iterator.next().value).toBe(3);
         expect(queue.length).toBe(0);
      });
   });

   describe("generic types", () => {
      it("should work with strings", () => {
         const queue = new Queue(["a", "b", "c"]);
         expect([...queue.shift()]).toEqual(["a", "b", "c"]);
      });

      it("should work with objects", () => {
         const obj1 = { id: 1 };
         const obj2 = { id: 2 };
         const queue = new Queue([obj1, obj2]);
         expect([...queue.shift()]).toEqual([obj1, obj2]);
      });
   });
});
