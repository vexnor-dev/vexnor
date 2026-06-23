import { assertType, describe, test, expect } from "vitest";
import { param, ctx, SqlParam, PathToNested, LeafPaths, PathType } from "#/core/query/sql-param.js";
import { PARAMS } from "#/core/sql-base.js";

describe("PathToNested — type utility", () => {
   test("single segment produces flat object", () => {
      assertType<PathToNested<"email", string>>({ email: "test" });
   });

   test("two segments produce nested object", () => {
      assertType<PathToNested<"orderBy.field", string>>({ orderBy: { field: "createdAt" } });
   });

   test("three segments produce deeply nested object", () => {
      assertType<PathToNested<"a.b.c", number>>({ a: { b: { c: 42 } } });
   });

   test("undefined type produces optional key", () => {
      assertType<PathToNested<"x", string | undefined>>({});
      assertType<PathToNested<"x", string | undefined>>({ x: "hello" });
   });
});

describe("LeafPaths — type utility", () => {
   test("flat object returns keys", () => {
      type T = { name: string; age: number };
      assertType<LeafPaths<T>>("name");
      assertType<LeafPaths<T>>("age");
   });

   test("nested object returns dot-paths to leaves only", () => {
      type T = { address: { city: string; zip: number }; name: string };
      assertType<LeafPaths<T>>("address.city");
      assertType<LeafPaths<T>>("address.zip");
      assertType<LeafPaths<T>>("name");
      // @ts-expect-error — "address" is not a leaf
      assertType<LeafPaths<T>>("address");
   });

   test("deeply nested", () => {
      type T = { a: { b: { c: boolean } } };
      assertType<LeafPaths<T>>("a.b.c");
      // @ts-expect-error — "a.b" is not a leaf
      assertType<LeafPaths<T>>("a.b");
      // @ts-expect-error — "a" is not a leaf
      assertType<LeafPaths<T>>("a");
   });
});

describe("PathType — type utility", () => {
   test("single segment resolves type", () => {
      type T = { name: string; age: number };
      assertType<PathType<T, "name">>("hello" as string);
      assertType<PathType<T, "age">>(42 as number);
   });

   test("nested segment resolves leaf type", () => {
      type T = { address: { city: string; zip: number } };
      assertType<PathType<T, "address.city">>("NYC" as string);
      assertType<PathType<T, "address.zip">>(10001 as number);
   });
});

describe("param() — leaf path enforcement", () => {
   test("flat param works", () => {
      const p = param<{ email: string }>("email");
      expect(p.name).toBe("email");
      type Params = typeof p extends SqlParam<infer U> ? U : never;
      assertType<Params["Name"]>("email" as const);
   });

   test("nested param with dot-path works", () => {
      const p = param<{ orderBy: { field: string } }>("orderBy.field");
      expect(p.name).toBe("orderBy.field");
   });

   test("param PARAMS type produces correct nested shape", () => {
      const p = param<{ orderBy: { field: string } }>("orderBy.field");
      assertType<typeof p[typeof PARAMS]>({ orderBy: { field: "createdAt" } });
   });

   test("flat param PARAMS type produces flat shape", () => {
      const p = param<{ email: string }>("email");
      assertType<typeof p[typeof PARAMS]>({ email: "test@test.com" });
   });

   // Type-level only — these should produce compile errors if uncommented:
   // param<{ address: { city: string } }>("address")  // ✗ not a leaf
   // param<{ name: string }>("bad")                    // ✗ not in T
});

describe("ctx() — leaf path enforcement", () => {
   test("flat ctx works", () => {
      const c = ctx<{ userId: string }>("userId");
      expect(c.name).toBe("userId");
      expect(c.isContext).toBe(true);
   });

   test("nested ctx with dot-path works", () => {
      const c = ctx<{ auth: { userId: string } }>("auth.userId");
      expect(c.name).toBe("auth.userId");
      expect(c.isContext).toBe(true);
   });
});

describe("SqlParam.resolve() — dot-path traversal", () => {
   test("resolves flat path", () => {
      const p = new SqlParam<{ Name: "email"; Type: string }>({ name: "email" });
      expect(p.resolve({ email: "test@test.com" })).toBe("test@test.com");
   });

   test("resolves nested path", () => {
      const p = new SqlParam<{ Name: "orderBy.field"; Type: string }>({ name: "orderBy.field" });
      expect(p.resolve({ orderBy: { field: "createdAt" } })).toBe("createdAt");
   });

   test("resolves deeply nested path", () => {
      const p = new SqlParam<{ Name: "a.b.c"; Type: number }>({ name: "a.b.c" });
      expect(p.resolve({ a: { b: { c: 42 } } })).toBe(42);
   });

   test("returns undefined for missing intermediate", () => {
      const p = new SqlParam<{ Name: "orderBy.field"; Type: string }>({ name: "orderBy.field" });
      expect(p.resolve({})).toBeUndefined();
   });

   test("returns undefined for null intermediate", () => {
      const p = new SqlParam<{ Name: "orderBy.field"; Type: string }>({ name: "orderBy.field" });
      expect(p.resolve({ orderBy: null })).toBeUndefined();
   });

   test("applies default when value is undefined", () => {
      const p = new SqlParam<{ Name: "x"; Type: string }>({ name: "x", validation: { default: "fallback" } });
      expect(p.resolve({})).toBe("fallback");
   });
});
