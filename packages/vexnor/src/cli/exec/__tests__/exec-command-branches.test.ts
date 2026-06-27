import "../../../test/mock-query-handler.js";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { execCommand } from "#src/cli/exec/exec-command.js";
import { join } from "path";
import * as confirmPromptModule from "#src/cli/exec/confirm-prompt.js";
import { mockDb } from "./fixtures/queries.vexnor.js";
import { testPlugin as mutationPlugin } from "./fixtures/mutation-queries.vexnor.js";

vi.mock("#src/cli/exec/confirm-prompt.js");

describe("execCommand — additional branches", () => {
   const mockMutationCreateConnection = vi.spyOn(mutationPlugin, "createConnection");
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

   test("uses env params when --env is specified and environment exists", async () => {
      const configPath = join(__dirname, "fixtures", "vexnor.config.ts");
      const queryConfigPath = join(__dirname, "fixtures", "env-queries.vexnor.ts");

      await execCommand("envQuery", {
         config: configPath,
         queryConfig: queryConfigPath,
         env: "staging",
         dryRun: true,
      });

      expect(consoleOutput.join("\n")).toContain("staging-value");
   });

   test("mutation query with confirmMutations=true prompts user", async () => {
      const configPath = join(__dirname, "fixtures", "confirm-mutations.config.ts");
      const queryConfigPath = join(__dirname, "fixtures", "mutation-queries.vexnor.ts");

      await execCommand("insertQuery", {
         config: configPath,
         queryConfig: queryConfigPath,
      });

      expect(mockConfirmPrompt).toHaveBeenCalledWith("Execute mutation query?", false);
   });

   test("mutation query cancelled when user denies confirmation", async () => {
      const configPath = join(__dirname, "fixtures", "confirm-mutations.config.ts");
      const queryConfigPath = join(__dirname, "fixtures", "mutation-queries.vexnor.ts");
      mockConfirmPrompt.mockResolvedValueOnce(false);

      await execCommand("insertQuery", {
         config: configPath,
         queryConfig: queryConfigPath,
      });

      expect(mockMutationCreateConnection).not.toHaveBeenCalled();
      expect(consoleOutput.join("\n")).toContain("Operation cancelled");
   });

   test("query execution failure throws with details", async () => {
      const configPath = join(__dirname, "fixtures", "vexnor.config.ts");
      const queryConfigPath = join(__dirname, "fixtures", "queries.vexnor.ts");
      vi.mocked(mockDb.query).mockRejectedValueOnce(new Error("relation does not exist"));

      await expect(
         execCommand("findAccountById", {
            config: configPath,
            queryConfig: queryConfigPath,
         }),
      ).rejects.toThrow("Query execution failed");
   });
});
