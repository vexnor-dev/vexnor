import { describe, expect, test } from "vitest";
import { loadPlugin } from "#src/load-plugin.js";

describe("loadPlugin — validation", () => {
   test("rejects invalid package name — no scope", async () => {
      await expect(loadPlugin("invalid-name")).rejects.toThrow("Invalid plugin package name");
   });

   test("rejects invalid package name — uppercase", async () => {
      await expect(loadPlugin("@vexnor/UPPER")).rejects.toThrow("Invalid plugin package name");
   });

   test("rejects invalid package name — wrong scope", async () => {
      await expect(loadPlugin("@other/postgres")).rejects.toThrow("Invalid plugin package name");
   });

   test("rejects package with no default export", async () => {
      await expect(loadPlugin("@vexnor/nonexistent")).rejects.toThrow();
   });
});
