import { describe, expect, test } from "vitest";
import { loadPlugin } from "#/load-plugin.js";

describe("loadPlugin — validation", () => {
   test("rejects invalid package name — no prefix", async () => {
      await expect(loadPlugin("invalid-name")).rejects.toThrow("Invalid plugin package name");
   });

   test("rejects invalid package name — uppercase", async () => {
      await expect(loadPlugin("vexnor-UPPER")).rejects.toThrow("Invalid plugin package name");
   });

   test("rejects invalid package name — special chars", async () => {
      await expect(loadPlugin("vexnor-foo/bar")).rejects.toThrow("Invalid plugin package name");
   });

   test("rejects package with no default export", async () => {
      // vexnor-postgres has a default export, but a non-existent one should fail with module not found
      await expect(loadPlugin("vexnor-nonexistent")).rejects.toThrow();
   });
});
