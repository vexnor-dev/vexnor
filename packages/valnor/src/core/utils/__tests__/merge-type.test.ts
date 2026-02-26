import { describe, test, assertType } from "vitest";
import { Merge, MergeAll } from "../merge-type.js";

describe("Merge type utility", () => {
   test("merges two object types", () => {
      type A = { a: string; b: number };
      type B = { c: boolean };
      type Result = Merge<A, B>;

      assertType<Result>({
         a: "",
         b: 1,
         c: true,
      });
   });

   test("creates union for overlapping keys", () => {
      type A = { a: string; b: number };
      type B = { b: boolean; c: string };
      type Result = Merge<A, B>;

      assertType<Result>({
         a: "",
         b: 1,
         c: "",
      });

      assertType<Result>({
         a: "",
         b: 1,
         c: "",
      });
   });

   test("returns A when B is not a record", () => {
      type A = { a: string };
      type B = string;
      type Result = Merge<A, B>;

      assertType<Result>({
         a: "a",
      });
   });

   test("returns B when A is not a record", () => {
      type A = number;
      type B = { b: string };
      type Result = Merge<A, B>;

      assertType<Result>({
         b: "b",
      });
   });

   test("returns never when neither A nor B are records", () => {
      type A = string;
      type B = number;
      type Result = Merge<A, B>;

      assertType<Result>({});
   });

   test("handles empty objects", () => {
      type A = {};
      type B = { b: string };
      type Result = Merge<A, B>;

      assertType<Result>({ b: "" });
   });
});

describe("MergeAll type utility", () => {
   test("merges multiple object types", () => {
      type A = { a: string };
      type B = { b: number };
      type C = { c: boolean };
      type Result = MergeAll<[A, B, C]>;

      assertType<Result>({ a: "string", b: 1, c: true });
   });

   test("handles overlapping keys across multiple types", () => {
      type A = { a: string; x: number };
      type B = { b: number; x: string };
      type C = { c: boolean; x: boolean };
      type Result = MergeAll<[A, B, C]>;

      assertType<Result>({
         a: "string",
         b: 1,
         c: true,
         x: true,
      });
   });

   test("skips non-record types in tuple", () => {
      type A = { a: string };
      type B = number;
      type C = { c: boolean };
      type Result = MergeAll<[A, B, C]>;

      assertType<Result>({
         a: "string",
         c: true,
      });
   });

   test("returns unknown for empty tuple", () => {
      type Result = MergeAll<[]>;

      assertType<Result>({});
   });

   test("handles single element tuple", () => {
      type A = { a: string };
      type Result = MergeAll<[A]>;

      assertType<Result>({
         a: "string",
      });
   });

   test("returns unknown when all elements are non-records", () => {
      type Result = MergeAll<[string, number, boolean]>;

      assertType<Result>({});
   });

   test("merges complex nested types", () => {
      type A = { a: { nested: string } };
      type B = { b: string[] };
      type C = { c: number | null };
      type Result = MergeAll<[A, B, C]>;

      assertType<Result>({
         a: {
            nested: "",
         },
         b: [""],
         c: null,
      });

      assertType<Result>({
         a: {
            nested: "",
         },
         b: [""],
         c: 1,
      });
   });

   test("merging types with optionals should result in optional fields", () => {
      type A = { a?: string };
      type B = { b?: number };
      type C = { c?: boolean };
      type Result = MergeAll<[A, B, C]>;

      assertType<Result>({
         a: "a",
      });
   });

   test("merging optional with required fields should result in required fields", () => {
      type A = { a: string; b: string; nested: { x: number } };
      type B = { a?: string; c: boolean };
      type Result = Merge<A, B>;

      assertType<Result>({
         a: "a",
         b: "b",
         c: true,
         nested: { x: 1 },
         // @ts-expect-error - field not existing
         x: "a",
      });
   });
});
