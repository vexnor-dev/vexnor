import { describe, expect, test, vi } from "vitest";
import { loadConfig } from "#src/config/load-config.js";
import { join } from "path";

const { createServer } = vi.hoisted(() => ({ createServer: vi.fn() }));

vi.mock("vite", () => ({ createServer }));

describe("loadConfig", () => {
   test("loads config from file", async () => {
      const configPath = join(__dirname, "fixtures", "vexnor.config.ts");
      const config = await loadConfig(configPath);

      expect(config.profiles.postgres).toBeDefined();
      expect(createServer).not.toHaveBeenCalled();
   });

   test("throws when no config exported", async () => {
      const configPath = join(__dirname, "fixtures", "empty.ts");
      await expect(loadConfig(configPath)).rejects.toThrow("No config exported");
   });
});
