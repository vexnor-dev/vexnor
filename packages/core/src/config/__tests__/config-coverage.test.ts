import { describe, expect, test, vi } from "vitest";

describe("config.ts — LOG_LEVEL branches", () => {
   test("LOG_LEVEL defaults to info when not set", async () => {
      const origLevel = process.env.LOG_LEVEL;
      delete process.env.LOG_LEVEL;
      // Re-import to trigger the IIFE
      vi.resetModules();
      const { LOG_LEVEL } = await import("#src/config.js");
      expect(LOG_LEVEL).toBe("info");
      if (origLevel) process.env.LOG_LEVEL = origLevel;
   });

   test("LOG_LEVEL returns info for invalid level", async () => {
      process.env.LOG_LEVEL = "invalid_level";
      vi.resetModules();
      const { LOG_LEVEL } = await import("#src/config.js");
      expect(LOG_LEVEL).toBe("info");
      delete process.env.LOG_LEVEL;
   });

   test("LOG_LEVEL returns valid level", async () => {
      process.env.LOG_LEVEL = "debug";
      vi.resetModules();
      const { LOG_LEVEL } = await import("#src/config.js");
      expect(LOG_LEVEL).toBe("debug");
      delete process.env.LOG_LEVEL;
   });
});

describe("cli/codegen/config.ts — LOG_LEVEL branches", () => {
   test("LOG_LEVEL defaults to info when not set", async () => {
      const origLevel = process.env.LOG_LEVEL;
      delete process.env.LOG_LEVEL;
      vi.resetModules();
      const { LOG_LEVEL } = await import("#src/cli/codegen/config.js");
      expect(LOG_LEVEL).toBe("info");
      if (origLevel) process.env.LOG_LEVEL = origLevel;
   });

   test("LOG_LEVEL returns info for invalid level", async () => {
      process.env.LOG_LEVEL = "garbage";
      vi.resetModules();
      const { LOG_LEVEL } = await import("#src/cli/codegen/config.js");
      expect(LOG_LEVEL).toBe("info");
      delete process.env.LOG_LEVEL;
   });

   test("LOG_LEVEL returns valid level", async () => {
      process.env.LOG_LEVEL = "error";
      vi.resetModules();
      const { LOG_LEVEL } = await import("#src/cli/codegen/config.js");
      expect(LOG_LEVEL).toBe("error");
      delete process.env.LOG_LEVEL;
   });
});

describe("load-config.ts — branch coverage", () => {
   test("throws when config file not found", async () => {
      const { loadConfig } = await import("#src/config/load-config.js");
      await expect(loadConfig("/nonexistent/path.ts")).rejects.toThrow("Config file not found");
   });

   test("throws when config file is a .js file that fails to import", async () => {
      const { loadConfig } = await import("#src/config/load-config.js");
      // Create a temp file that exists but has invalid content
      const fs = await import("fs/promises");
      const path = await import("path");
      const os = await import("os");
      const tmpFile = path.join(os.tmpdir(), "vexnor-test-bad-config.js");
      await fs.writeFile(tmpFile, "throw new Error('broken');");
      await expect(loadConfig(tmpFile)).rejects.toThrow("Failed to load config");
      await fs.unlink(tmpFile);
   });

   test("throws when config file exports nothing", async () => {
      const { loadConfig } = await import("#src/config/load-config.js");
      const fs = await import("fs/promises");
      const path = await import("path");
      const os = await import("os");
      const tmpFile = path.join(os.tmpdir(), "vexnor-test-empty-config.mjs");
      await fs.writeFile(tmpFile, "export const other = 123;");
      await expect(loadConfig(tmpFile)).rejects.toThrow("No config exported");
      await fs.unlink(tmpFile);
   });
});

describe("load-query-config.ts — branch coverage", () => {
   test("throws when query config file not found", async () => {
      const { loadQueryConfig } = await import("#src/config/load-query-config.js");
      await expect(loadQueryConfig("/nonexistent/queries.ts")).rejects.toThrow("Query config file not found");
   });
});
