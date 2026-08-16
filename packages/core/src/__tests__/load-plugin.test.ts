import { describe, expect, test, vi } from "vitest";
import { loadPlugin } from "#src/load-plugin.js";

const pathToFileURL = vi.hoisted(() => vi.fn());

vi.mock("url", async () => {
   const url = await vi.importActual<typeof import("url")>("url");
   pathToFileURL.mockImplementation(url.pathToFileURL);
   return { ...url, pathToFileURL };
});

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
      pathToFileURL.mockClear();
      await expect(loadPlugin("@vexnor/nonexistent")).rejects.toThrow();
      expect(pathToFileURL).toHaveBeenCalledOnce();
   });
});
