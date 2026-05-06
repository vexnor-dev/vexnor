import { describe, expect, test, vi } from "vitest";
import { loadPlugin } from "#/load-plugin.js";
import testPlugin from "#/cli/exec/__tests__/test-plugin.js";

vi.mock("vexnor-test", () => ({ default: testPlugin }));

describe("loadPlugin validation", () => {
   test("loads a valid package", async () => {
      const { plugin, path } = await loadPlugin("vexnor-test");
      expect(plugin).toBe(testPlugin);
      expect(path).toMatchInlineSnapshot(`"vexnor-test"`);
   });

   test("throws on non-vexnor package name", async () => {
      await expect(loadPlugin("some-other-plugin")).rejects.toMatchInlineSnapshot(
         `[Error: Invalid plugin package name: some-other-plugin]`,
      );
   });

   test("throws on path traversal in package name", async () => {
      await expect(loadPlugin("../evil")).rejects.toMatchInlineSnapshot(
         `[Error: Invalid plugin package name: ../evil]`,
      );
   });

   test("throws on absolute path in package name", async () => {
      await expect(loadPlugin("/absolute/path")).rejects.toMatchInlineSnapshot(
         `[Error: Invalid plugin package name: /absolute/path]`,
      );
   });
});
