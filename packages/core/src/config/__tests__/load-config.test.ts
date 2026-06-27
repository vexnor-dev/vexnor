import { describe, expect, test } from "vitest";
import { loadConfig } from "#src/config/load-config.js";
import { join } from "path";

describe("loadConfig", () => {
   test("loads config from file", async () => {
      const configPath = join(__dirname, "fixtures", "vexnor.config.ts");
      const config = await loadConfig(configPath);

      expect(config.profiles.postgres).toBeDefined();
   });

   test("throws when no config exported", async () => {
      const configPath = join(__dirname, "fixtures", "empty.ts");
      await expect(loadConfig(configPath)).rejects.toThrow("No config exported");
   });
});
