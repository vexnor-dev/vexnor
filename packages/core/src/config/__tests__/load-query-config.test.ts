import { describe, expect, test } from "vitest";
import { loadQueryConfig } from "#src/config/load-query-config.js";
import { join } from "path";

describe("loadQueryConfig", () => {
   test("loads query config from file", async () => {
      const configPath = join(__dirname, "fixtures", "queries.vexnor.ts");
      const config = await loadQueryConfig(configPath);

      expect(config.queries.findAccountById).toBeDefined();
      expect(config.queries.findAccountById?.profile).toBe("postgres");
   });

   test("throws when no config exported", async () => {
      const configPath = join(__dirname, "fixtures", "empty.ts");
      await expect(loadQueryConfig(configPath)).rejects.toThrow("No config exported");
   });
});
