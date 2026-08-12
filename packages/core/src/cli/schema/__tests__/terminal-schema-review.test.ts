import { describe, expect, test } from "vitest";
import type { SchemaSelectionReview } from "#src/schema/schema-selection.js";
import { reviewSchemaSelectionInTerminal } from "#src/cli/schema/terminal-schema-review.js";

const review: SchemaSelectionReview = {
   schemas: ["alpha", "beta"],
   firstRun: false,
   objects: [
      { id: "alpha.event_log", schema: "alpha", name: "event_log", kind: "table", selected: true, status: "existing" },
      { id: "alpha.record", schema: "alpha", name: "record", kind: "table", selected: false, status: "new" },
      { id: "beta.event_view", schema: "beta", name: "event_view", kind: "view", selected: false, status: "existing" },
   ],
   removedObjects: [{ id: "alpha.old_record", kind: "table", selected: true }],
};

function terminal(answers: string[]) {
   const output: string[] = [];
   return {
      output,
      io: {
         write: (message: string) => output.push(message),
         prompt: async (message: string) => {
            output.push(message);
            const answer = answers.shift();
            if (answer === undefined) throw new Error("Test prompt has no answer");
            return answer;
         },
      },
   };
}

describe("reviewSchemaSelectionInTerminal", () => {
   test("groups objects by schema and supports schema and individual toggles", async () => {
      const { io, output } = terminal(["schema alpha off", "object alpha.record on", "schema beta on", "save", "yes"]);

      expect(await reviewSchemaSelectionInTerminal(review, io)).toMatchInlineSnapshot(`
        {
          "confirmRemoved": true,
          "selected": [
            "alpha.record",
            "beta.event_view",
          ],
        }
      `);
      expect(output).toMatchInlineSnapshot(`
        [
          "Schema review: prior selections are restored; newly discovered objects start unselected.",
          "Schema alpha",
          "  [x] table alpha.event_log",
          "  [ ] table alpha.record NEW",
          "Schema beta",
          "  [ ] view beta.event_view",
          "Removed objects pending confirmation:",
          "  [-] table alpha.old_record",
          "Commands: all, none, schema <name> <on|off|toggle>, object <schema.name> <on|off|toggle>, list, save, cancel",
          "selection> ",
          "selection> ",
          "selection> ",
          "selection> ",
          "Prune the removed objects from local selection state? Type 'yes' to confirm: ",
        ]
      `);
   });

   test("requires explicit removed-object confirmation", async () => {
      const { io } = terminal(["save", "no"]);
      await expect(reviewSchemaSelectionInTerminal(review, io)).rejects.toThrowErrorMatchingInlineSnapshot(`[SchemaSelectionError: Removed schema objects were not confirmed for pruning]`);
   });

   test("rejects unknown commands and can continue", async () => {
      const withoutRemoved = { ...review, removedObjects: [] };
      const { io, output } = terminal(["object alpha.missing on", "all", "save"]);

      expect(await reviewSchemaSelectionInTerminal(withoutRemoved, io)).toMatchInlineSnapshot(`
        {
          "confirmRemoved": true,
          "selected": [
            "alpha.event_log",
            "alpha.record",
            "beta.event_view",
          ],
        }
      `);
      expect(output.filter((message) => message.startsWith("Invalid selection command"))).toMatchInlineSnapshot(`
        [
          "Invalid selection command: object alpha.missing on",
        ]
      `);
   });

   test("cancels without returning a selection", async () => {
      const { io } = terminal(["cancel"]);
      await expect(reviewSchemaSelectionInTerminal(review, io)).rejects.toThrowErrorMatchingInlineSnapshot(`[SchemaSelectionError: Schema selection cancelled]`);
   });
});
