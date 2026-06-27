import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { initCommand } from "#src/cli/exec/init-command.js";

const TEST_DIR = path.join(process.cwd(), "test-init-output");

describe("initCommand", () => {
   beforeEach(async () => {
      await fs.mkdir(TEST_DIR, { recursive: true });
      process.chdir(TEST_DIR);
   });

   afterEach(async () => {
      process.chdir(path.join(TEST_DIR, ".."));
      await fs.rm(TEST_DIR, { recursive: true, force: true });
   });

   it("should create vexnor.config.ts and queries.vexnor.ts", async () => {
      await initCommand({});

      const configExists = await fs
         .access("vexnor.config.ts")
         .then(() => true)
         .catch(() => false);
      const queryConfigExists = await fs
         .access("queries.vexnor.ts")
         .then(() => true)
         .catch(() => false);

      expect(configExists).toBe(true);
      expect(queryConfigExists).toBe(true);
   });

   it("should create valid config file content", async () => {
      await initCommand({});

      const configContent = await fs.readFile("vexnor.config.ts", "utf-8");

      expect(configContent).toContain(`import { defineConfig } from "@vexnor/core"`);
      expect(configContent).toContain(`plugin: "<SET ME>"`);
      expect(configContent).toContain(`defaultProfile: "dev"`);
      expect(configContent).toContain(`confirmMutations: true`);
   });

   it("should create valid query config file content", async () => {
      await initCommand({});

      const queryConfigContent = await fs.readFile("queries.vexnor.ts", "utf-8");

      expect(queryConfigContent).toContain('import { defineQueryConfig } from "@vexnor/core"');
      expect(queryConfigContent).toContain('import { sql } from "@vexnor/core"');
      expect(queryConfigContent).toContain("exampleQuery");
   });

   it("should throw error if vexnor.config.ts exists without force", async () => {
      await fs.writeFile("vexnor.config.ts", "existing", "utf-8");

      await expect(initCommand({})).rejects.toThrow("vexnor.config.ts already exists. Use --force to overwrite.");
   });

   it("should throw error if queries.vexnor.ts exists without force", async () => {
      await fs.writeFile("queries.vexnor.ts", "existing", "utf-8");

      await expect(initCommand({})).rejects.toThrow("queries.vexnor.ts already exists. Use --force to overwrite.");
   });

   it("should overwrite existing files with force option", async () => {
      await fs.writeFile("vexnor.config.ts", "existing config", "utf-8");
      await fs.writeFile("queries.vexnor.ts", "existing queries", "utf-8");

      await initCommand({ force: true });

      const configContent = await fs.readFile("vexnor.config.ts", "utf-8");
      const queryConfigContent = await fs.readFile("queries.vexnor.ts", "utf-8");

      expect(configContent).not.toBe("existing config");
      expect(queryConfigContent).not.toBe("existing queries");
      expect(configContent).toContain("defineConfig");
      expect(queryConfigContent).toContain("defineQueryConfig");
   });
});
