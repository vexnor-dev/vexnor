import "../../../test/mock-query-handler.js";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { execCommand } from "#src/cli/exec/exec-command.js";
import { join } from "path";
import * as confirmPromptModule from "#src/cli/exec/confirm-prompt.js";
import type { MockResult } from "#src/test/mock-plugin.js";
import { testPlugin as queriesPlugin, mockDb } from "./fixtures/queries.vexnor.js";
import { testPlugin as mutationPlugin } from "./fixtures/mutation-queries.vexnor.js";
import { testPlugin as runtimePlugin } from "./fixtures/runtime-queries.vexnor.js";

vi.mock("#src/cli/exec/confirm-prompt.js");

function setTestMockData(rows: unknown[]) {
   vi.mocked(mockDb.query).mockResolvedValueOnce({ rows } as MockResult<unknown>);
}

describe("execCommand", () => {
   const mockCreateConnection = vi.spyOn(queriesPlugin, "createConnection");
   const mockMutationCreateConnection = vi.spyOn(mutationPlugin, "createConnection");
   const mockRuntimeCreateConnection = vi.spyOn(runtimePlugin, "createConnection");
   const mockConfirmPrompt = vi.mocked(confirmPromptModule.confirmPrompt);

   let consoleOutput: string[] = [];

   beforeEach(() => {
      vi.clearAllMocks();
      mockConfirmPrompt.mockResolvedValue(true);
      consoleOutput = [];
      vi.spyOn(console, "log").mockImplementation((...args) => {
         consoleOutput.push([...args].join(""));
      });
   });

   test("throws when query config not provided", async () => {
      const configPath = join(__dirname, "fixtures", "vexnor.config.ts");

      await expect(
         execCommand("findAccount", {
            config: configPath,
         }),
      ).rejects.toThrow("--query-config is required");
   });

   test("throws when query not found", async () => {
      const configPath = join(__dirname, "fixtures", "vexnor.config.ts");
      const queryConfigPath = join(__dirname, "fixtures", "queries.vexnor.ts");

      await expect(
         execCommand("nonExistent", {
            config: configPath,
            queryConfig: queryConfigPath,
         }),
      ).rejects.toThrow("Query 'nonExistent' not found in config");
   });

   test("throws when profile not found", async () => {
      const configPath = join(__dirname, "fixtures", "vexnor.config.ts");
      const queryConfigPath = join(__dirname, "fixtures", "bad-profile.vexnor.ts");

      await expect(
         execCommand("findAccountById", {
            config: configPath,
            queryConfig: queryConfigPath,
         }),
      ).rejects.toThrow();
   });

   test("executes query with default params", async () => {
      const configPath = join(__dirname, "fixtures", "vexnor.config.ts");
      const queryConfigPath = join(__dirname, "fixtures", "queries.vexnor.ts");

      await execCommand("findAccountById", {
         config: configPath,
         queryConfig: queryConfigPath,
      });

      expect(mockCreateConnection).toHaveBeenCalledWith({ config: { uri: "test://localhost" } });
   });

   test("dry run mode outputs SQL without executing", async () => {
      const configPath = join(__dirname, "fixtures", "vexnor.config.ts");
      const queryConfigPath = join(__dirname, "fixtures", "queries.vexnor.ts");

      await execCommand("findAccountById", {
         config: configPath,
         queryConfig: queryConfigPath,
         dryRun: true,
      });

      expect(mockCreateConnection).not.toHaveBeenCalled();
   });

   test("closes connection on error", async () => {
      const configPath = join(__dirname, "fixtures", "vexnor.config.ts");
      const queryConfigPath = join(__dirname, "fixtures", "queries.vexnor.ts");
      mockCreateConnection.mockRejectedValueOnce(new Error("Connection error"));

      await expect(
         execCommand("findAccountById", {
            config: configPath,
            queryConfig: queryConfigPath,
         }),
      ).rejects.toThrow("Connection error");
   });

   test("outputs JSON format by default", async () => {
      const configPath = join(__dirname, "fixtures", "vexnor.config.ts");
      const queryConfigPath = join(__dirname, "fixtures", "queries.vexnor.ts");
      setTestMockData([
         { id: 1, name: "Alice", email: "alice@example.com" },
         { id: 2, name: "Bob", email: "bob@example.com" },
      ]);

      await execCommand("findAccountById", {
         config: configPath,
         queryConfig: queryConfigPath,
      });

      expect(consoleOutput.join("\n")).toMatchSnapshot();
   });

   test("outputs CSV format when specified", async () => {
      const configPath = join(__dirname, "fixtures", "vexnor.config.ts");
      const queryConfigPath = join(__dirname, "fixtures", "queries.vexnor.ts");
      setTestMockData([
         { id: 1, name: "Alice", email: "alice@example.com" },
         { id: 2, name: "Bob", email: "bob@example.com" },
      ]);

      await execCommand("findAccountById", {
         config: configPath,
         queryConfig: queryConfigPath,
         format: "csv",
      });

      expect(consoleOutput.join("\n")).toMatchSnapshot();
   });

   test("outputs table format when specified", async () => {
      const configPath = join(__dirname, "fixtures", "vexnor.config.ts");
      const queryConfigPath = join(__dirname, "fixtures", "queries.vexnor.ts");
      setTestMockData([
         { id: 1, name: "Alice", email: "alice@example.com" },
         { id: 2, name: "Bob", email: "bob@example.com" },
      ]);

      await execCommand("findAccountById", {
         config: configPath,
         queryConfig: queryConfigPath,
         format: "table",
      });

      expect(consoleOutput.join("\n")).toMatchSnapshot();
   });

   test("applies limit to results", async () => {
      const configPath = join(__dirname, "fixtures", "vexnor.config.ts");
      const queryConfigPath = join(__dirname, "fixtures", "queries.vexnor.ts");
      setTestMockData([
         { id: 1, name: "Alice" },
         { id: 2, name: "Bob" },
         { id: 3, name: "Charlie" },
      ]);

      await execCommand("findAccountById", {
         config: configPath,
         queryConfig: queryConfigPath,
         limit: 2,
      });

      expect(consoleOutput.join("\n")).toMatchSnapshot();
   });

   test("skips confirmation with --confirm flag", async () => {
      const configPath = join(__dirname, "fixtures", "vexnor.config.ts");
      const queryConfigPath = join(__dirname, "fixtures", "mutation-queries.vexnor.ts");

      await execCommand("insertQuery", {
         config: configPath,
         queryConfig: queryConfigPath,
         confirm: true,
      });

      expect(mockConfirmPrompt).not.toHaveBeenCalled();
   });

   test("prompts for destructive queries by default", async () => {
      const configPath = join(__dirname, "fixtures", "vexnor.config.ts");
      const queryConfigPath = join(__dirname, "fixtures", "mutation-queries.vexnor.ts");

      await execCommand("dropQuery", {
         config: configPath,
         queryConfig: queryConfigPath,
      });

      expect(mockConfirmPrompt).toHaveBeenCalledWith("⚠️  DESTRUCTIVE operation! Are you sure?", true);
   });

   test("cancels operation when confirmation denied", async () => {
      const configPath = join(__dirname, "fixtures", "vexnor.config.ts");
      const queryConfigPath = join(__dirname, "fixtures", "mutation-queries.vexnor.ts");
      mockConfirmPrompt.mockResolvedValueOnce(false);

      await execCommand("dropQuery", {
         config: configPath,
         queryConfig: queryConfigPath,
      });

      expect(mockMutationCreateConnection).not.toHaveBeenCalled();
      expect(consoleOutput.join("\n")).toContain("Operation cancelled");
   });

   // ── --context flag ───────────────────────────────────────────────────

   test("--context substitutes contextValue sentinel with provided value", async () => {
      const configPath = join(__dirname, "fixtures", "vexnor.config.ts");
      const queryConfigPath = join(__dirname, "fixtures", "runtime-queries.vexnor.ts");

      await execCommand("selectMyOrders", {
         config: configPath,
         queryConfig: queryConfigPath,
         context: ["userId=u-abc"],
      });

      expect(mockRuntimeCreateConnection).toHaveBeenCalled();
   });

   test("--context dry-run shows substituted value in SQL output", async () => {
      const configPath = join(__dirname, "fixtures", "vexnor.config.ts");
      const queryConfigPath = join(__dirname, "fixtures", "runtime-queries.vexnor.ts");

      await execCommand("selectMyOrders", {
         config: configPath,
         queryConfig: queryConfigPath,
         context: ["userId=u-abc"],
         dryRun: true,
      });

      expect(consoleOutput.join("\n")).toContain("u-abc");
      expect(mockRuntimeCreateConnection).not.toHaveBeenCalled();
   });

   test("throws when context param has contextValue but no --context override provided", async () => {
      const configPath = join(__dirname, "fixtures", "vexnor.config.ts");
      const queryConfigPath = join(__dirname, "fixtures", "runtime-queries.vexnor.ts");

      await expect(
         execCommand("selectMyOrders", {
            config: configPath,
            queryConfig: queryConfigPath,
            // no context: [] provided
         }),
      ).rejects.toThrow("Context param 'userId' has no value");
   });

   test("throws on malformed --context entry (missing =)", async () => {
      const configPath = join(__dirname, "fixtures", "vexnor.config.ts");
      const queryConfigPath = join(__dirname, "fixtures", "runtime-queries.vexnor.ts");

      await expect(
         execCommand("selectMyOrders", {
            config: configPath,
            queryConfig: queryConfigPath,
            context: ["userIdNoEquals"],
         }),
      ).rejects.toThrow("Invalid --context value 'userIdNoEquals': expected key=value");
   });
});
