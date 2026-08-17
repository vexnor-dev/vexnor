import { describe, expect, test } from "vitest";
import type { SchemaSelectionReview } from "#src/schema/schema-selection.js";
import { reviewSchemaSelectionInTerminal } from "#src/cli/schema/terminal-schema-review.js";

type TerminalSchemaReviewKey = {
   name?: string;
   sequence?: string;
   ctrl?: boolean;
};

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

function terminal(keys: TerminalSchemaReviewKey[], pageSize?: number) {
   const frames: string[][] = [];
   let closed = false;
   return {
      frames,
      isClosed: () => closed,
      io: {
         pageSize,
         render: (lines: readonly string[]) => frames.push([...lines]),
         readKey: async () => {
            const key = keys.shift();
            if (key === undefined) throw new Error("Test prompt has no key");
            return key;
         },
         close: () => {
            closed = true;
         },
      },
   };
}

describe("reviewSchemaSelectionInTerminal", () => {
   test("renders grouped checkboxes and supports navigation and individual toggles", async () => {
      const terminalIo = terminal([
         { name: "down" },
         { name: "space", sequence: " " },
         { name: "down" },
         { name: "space", sequence: " " },
         { name: "return", sequence: "\r" },
         { name: "y", sequence: "y" },
      ]);

      expect(await reviewSchemaSelectionInTerminal(review, terminalIo.io)).toMatchInlineSnapshot(`
        {
          "confirmRemoved": true,
          "selected": [
            "alpha.event_log",
            "alpha.record",
            "beta.event_view",
          ],
        }
      `);
      expect({ first: terminalIo.frames[0], last: terminalIo.frames.at(-1), closed: terminalIo.isClosed() })
         .toMatchInlineSnapshot(`
        {
          "closed": true,
          "first": [
            "Schema review: prior selections are restored; newly discovered objects start unselected.",
            "Showing 3/3 · Selected 1/3 · Filter: all",
            "Search: ",
            "",
            "Schema alpha",
            "> [x] table alpha.event_log",
            "  [ ] table alpha.record NEW",
            "Schema beta",
            "  [ ] view beta.event_view",
            "",
            "Removed objects pending confirmation:",
            "  [-] table alpha.old_record",
            "",
            "↑/↓ navigate · Space toggle · a toggle visible · Tab checked filter · / search · Enter save · Esc cancel",
          ],
          "last": [
            "Removed objects pending confirmation:",
            "  [-] table alpha.old_record",
            "",
            "Prune these removed objects from local selection state? y/N",
          ],
        }
      `);
   });

   test("filters by text and toggles only the matching visible objects", async () => {
      const terminalIo = terminal([
         { name: "slash", sequence: "/" },
         { name: "r", sequence: "r" },
         { name: "e", sequence: "e" },
         { name: "c", sequence: "c" },
         { name: "backspace", sequence: "\b" },
         { name: "c", sequence: "c" },
         { name: "o", sequence: "o" },
         { name: "r", sequence: "r" },
         { name: "d", sequence: "d" },
         { name: "return", sequence: "\r" },
         { name: "a", sequence: "a" },
         { name: "return", sequence: "\r" },
         { name: "y", sequence: "y" },
      ]);

      expect(await reviewSchemaSelectionInTerminal(review, terminalIo.io)).toMatchInlineSnapshot(`
        {
          "confirmRemoved": true,
          "selected": [
            "alpha.event_log",
            "alpha.record",
          ],
        }
      `);
      expect(terminalIo.frames.findLast((frame) => frame[2] === "Search: record")).toMatchInlineSnapshot(`
        [
          "Schema review: prior selections are restored; newly discovered objects start unselected.",
          "Showing 1/3 · Selected 2/3 · Filter: all",
          "Search: record",
          "",
          "Schema alpha",
          "> [x] table alpha.record NEW",
          "",
          "Removed objects pending confirmation:",
          "  [-] table alpha.old_record",
          "",
          "↑/↓ navigate · Space toggle · a toggle visible · Tab checked filter · / search · Enter save · Esc cancel",
        ]
      `);
   });

   test("cycles checked and unchecked filters while preserving hidden selections", async () => {
      const withoutRemoved = { ...review, removedObjects: [] };
      const terminalIo = terminal([
         { name: "tab", sequence: "\t" },
         { name: "tab", sequence: "\t" },
         { name: "space", sequence: " " },
         { name: "return", sequence: "\r" },
      ]);

      expect(await reviewSchemaSelectionInTerminal(withoutRemoved, terminalIo.io)).toMatchInlineSnapshot(`
        {
          "confirmRemoved": true,
          "selected": [
            "alpha.event_log",
            "alpha.record",
          ],
        }
      `);
      expect(terminalIo.frames.filter((frame) => frame[1]?.includes("Filter:"))).toMatchInlineSnapshot(`
        [
          [
            "Schema review: prior selections are restored; newly discovered objects start unselected.",
            "Showing 3/3 · Selected 1/3 · Filter: all",
            "Search: ",
            "",
            "Schema alpha",
            "> [x] table alpha.event_log",
            "  [ ] table alpha.record NEW",
            "Schema beta",
            "  [ ] view beta.event_view",
            "",
            "↑/↓ navigate · Space toggle · a toggle visible · Tab checked filter · / search · Enter save · Esc cancel",
          ],
          [
            "Schema review: prior selections are restored; newly discovered objects start unselected.",
            "Showing 1/3 · Selected 1/3 · Filter: checked",
            "Search: ",
            "",
            "Schema alpha",
            "> [x] table alpha.event_log",
            "",
            "↑/↓ navigate · Space toggle · a toggle visible · Tab checked filter · / search · Enter save · Esc cancel",
          ],
          [
            "Schema review: prior selections are restored; newly discovered objects start unselected.",
            "Showing 2/3 · Selected 1/3 · Filter: unchecked",
            "Search: ",
            "",
            "Schema alpha",
            "> [ ] table alpha.record NEW",
            "Schema beta",
            "  [ ] view beta.event_view",
            "",
            "↑/↓ navigate · Space toggle · a toggle visible · Tab checked filter · / search · Enter save · Esc cancel",
          ],
          [
            "Schema review: prior selections are restored; newly discovered objects start unselected.",
            "Showing 1/3 · Selected 2/3 · Filter: unchecked",
            "Search: ",
            "",
            "Schema beta",
            "> [ ] view beta.event_view",
            "",
            "↑/↓ navigate · Space toggle · a toggle visible · Tab checked filter · / search · Enter save · Esc cancel",
          ],
        ]
      `);
   });

   test("clears active search before escape cancels", async () => {
      const withoutRemoved = { ...review, removedObjects: [] };
      const terminalIo = terminal([
         { name: "slash", sequence: "/" },
         { name: "z", sequence: "z" },
         { name: "return", sequence: "\r" },
         { name: "space", sequence: " " },
         { name: "escape", sequence: "\u001b" },
         { name: "return", sequence: "\r" },
      ]);

      expect(await reviewSchemaSelectionInTerminal(withoutRemoved, terminalIo.io)).toMatchInlineSnapshot(`
        {
          "confirmRemoved": true,
          "selected": [
            "alpha.event_log",
          ],
        }
      `);
      expect(
         terminalIo.frames.some((frame) => frame.includes("No schema objects match the active filters.")),
      ).toMatchInlineSnapshot(`true`);
   });

   test("clears search mode with escape and pages long selections around the cursor", async () => {
      const firstRun = {
         ...review,
         firstRun: true,
         objects: review.objects.map((object) => ({ ...object, selected: true, status: "existing" as const })),
         removedObjects: [],
      };
      const terminalIo = terminal(
         [
            { name: "slash", sequence: "/" },
            { name: "e", sequence: "e" },
            { name: "escape", sequence: "\u001b" },
            { name: "down" },
            { name: "down" },
            { name: "return", sequence: "\r" },
         ],
         2,
      );

      expect(await reviewSchemaSelectionInTerminal(firstRun, terminalIo.io)).toMatchInlineSnapshot(`
        {
          "confirmRemoved": true,
          "selected": [
            "alpha.event_log",
            "alpha.record",
            "beta.event_view",
          ],
        }
      `);
      expect(terminalIo.frames.at(-1)).toMatchInlineSnapshot(`
        [
          "First schema review: all discovered objects start selected.",
          "Showing 3/3 · Selected 3/3 · Filter: all",
          "Search: ",
          "",
          "Schema beta",
          "> [x] view beta.event_view",
          "Objects 3-3 of 3",
          "",
          "↑/↓ navigate · Space toggle · a toggle visible · Tab checked filter · / search · Enter save · Esc cancel",
        ]
      `);
   });

   test("cycles back to all, wraps upward, and deselects an entirely checked filtered set", async () => {
      const withoutRemoved = { ...review, removedObjects: [] };
      const terminalIo = terminal([
         { name: "tab", sequence: "\t" },
         { name: "tab", sequence: "\t" },
         { name: "tab", sequence: "\t" },
         { name: "up" },
         { name: "space", sequence: " " },
         { name: "slash", sequence: "/" },
         { name: "b", sequence: "b" },
         { name: "e", sequence: "e" },
         { name: "t", sequence: "t" },
         { name: "a", sequence: "a" },
         { name: "return", sequence: "\r" },
         { name: "a", sequence: "a" },
         { name: "return", sequence: "\r" },
      ]);

      expect(await reviewSchemaSelectionInTerminal(withoutRemoved, terminalIo.io)).toMatchInlineSnapshot(`
        {
          "confirmRemoved": true,
          "selected": [
            "alpha.event_log",
          ],
        }
      `);
      expect(terminalIo.frames.at(-1)).toMatchInlineSnapshot(`
        [
          "Schema review: prior selections are restored; newly discovered objects start unselected.",
          "Showing 1/3 · Selected 1/3 · Filter: all",
          "Search: beta",
          "",
          "Schema beta",
          "> [ ] view beta.event_view",
          "",
          "↑/↓ navigate · Space toggle · a toggle visible · Tab checked filter · / search · Enter save · Esc cancel",
        ]
      `);
   });

   test("requires explicit removed-object confirmation", async () => {
      const terminalIo = terminal([
         { name: "return", sequence: "\r" },
         { name: "n", sequence: "n" },
      ]);
      await expect(reviewSchemaSelectionInTerminal(review, terminalIo.io)).rejects.toThrowErrorMatchingInlineSnapshot(
         `[SchemaSelectionError: Removed schema objects were not confirmed for pruning]`,
      );
      expect(terminalIo.isClosed()).toMatchInlineSnapshot(`true`);
   });

   test("cancels with escape or Ctrl-C and always closes the terminal", async () => {
      const escape = terminal([{ name: "escape", sequence: "\u001b" }]);
      const ctrlC = terminal([{ name: "c", sequence: "\u0003", ctrl: true }]);

      await expect(reviewSchemaSelectionInTerminal(review, escape.io)).rejects.toThrowErrorMatchingInlineSnapshot(
         `[SchemaSelectionError: Schema selection cancelled]`,
      );
      await expect(reviewSchemaSelectionInTerminal(review, ctrlC.io)).rejects.toThrowErrorMatchingInlineSnapshot(
         `[SchemaSelectionError: Schema selection cancelled]`,
      );
      expect({ escape: escape.isClosed(), ctrlC: ctrlC.isClosed() }).toMatchInlineSnapshot(`
        {
          "ctrlC": true,
          "escape": true,
        }
      `);
   });
});
