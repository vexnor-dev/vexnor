import { describe, test, expectTypeOf } from "vitest";
import { MergeAll } from "../merge-type.js";

describe("Merge<> type tests", () => {
   test("merges two record types", () => {
      type A = { a: string };
      type B = { b: number };
      type Result = MergeAll<[A, B]>;

      expectTypeOf<Result>().toEqualTypeOf<{ a: string; b: number }>();
   });

   test("merges three record types", () => {
      type A = { a: string };
      type B = { b: number };
      type C = { c: boolean };
      type Result = MergeAll<[A, B, C]>;

      expectTypeOf<Result>().toEqualTypeOf<{ a: string; b: number; c: boolean }>();
   });

   test("handles empty array", () => {
      type Result = MergeAll<[]>;

      expectTypeOf<Result>().toEqualTypeOf<unknown>();
   });

   test("handles single record type", () => {
      type A = { a: string; b: number };
      type Result = MergeAll<[A]>;

      expectTypeOf<Result>().toEqualTypeOf<{ a: string; b: number }>();
   });

   test("merges overlapping properties (intersection behavior)", () => {
      type A = { a: string; shared: number };
      type B = { b: boolean; shared: string };
      type Result = MergeAll<[A, B]>;

      expectTypeOf<Result>().toEqualTypeOf<{ a: string; b: boolean; shared: number | string }>();
   });

   test("merges complex nested types", () => {
      type A = { user: { id: number } };
      type B = { post: { title: string } };
      type C = { meta: { count: number } };
      type Result = MergeAll<[A, B, C]>;

      expectTypeOf<Result>().toEqualTypeOf<{
         user: { id: number };
         post: { title: string };
         meta: { count: number };
      }>();
   });

   test("merges with unknown types in array", () => {
      type A = { a: string };
      type Result = MergeAll<[A, unknown]>;

      expectTypeOf<Result>().toEqualTypeOf<{ a: string }>();
   });

   test("merges with unknown in middle of array", () => {
      type A = { a: string };
      type B = { b: number };
      type Result = MergeAll<[A, unknown, B]>;

      expectTypeOf<Result>().toEqualTypeOf<{ a: string; b: number }>();
   });

   test("merges with Record<string, unknown> in array", () => {
      type A = { a: string };
      type B = { b: number };
      type Result = MergeAll<[A, B, unknown]>;

      // Should NOT produce index signature
      expectTypeOf<Result>().toEqualTypeOf<{ a: string; b: number }>();
   });

   test("merges with empty object in array", () => {
      type A = { a: string };
      type B = { b: number };
      type Result = MergeAll<[A, B, unknown]>;

      expectTypeOf<Result>().toEqualTypeOf<{ a: string; b: number }>();
   });
});
