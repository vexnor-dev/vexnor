import { EventEmitter } from "node:events";
import { describe, expect, test, vi } from "vitest";
import type { SchemaSelectionReview } from "#src/schema/schema-selection.js";

const input = Object.assign(new EventEmitter(), {
   isTTY: true,
   isRaw: false,
   readableFlowing: null,
   pause: vi.fn(),
   resume: vi.fn(),
   setRawMode: vi.fn((raw: boolean) => {
      input.isRaw = raw;
   }),
});
const output = {
   isTTY: true,
   rows: 24,
   write: vi.fn(() => true),
};
const emitKeypressEvents = vi.fn();

vi.doMock("node:process", () => ({ stdin: input, stdout: output }));
vi.doMock("node:readline", () => ({ emitKeypressEvents }));

const review: SchemaSelectionReview = {
   schemas: ["alpha"],
   firstRun: false,
   objects: [
      { id: "alpha.event", schema: "alpha", name: "event", kind: "table", selected: true, status: "existing" },
      { id: "alpha.record", schema: "alpha", name: "record", kind: "table", selected: false, status: "new" },
   ],
   removedObjects: [],
};

describe("terminal schema review TTY adapter", () => {
   test("queues burst keypresses and restores the terminal after saving", async () => {
      const { reviewSchemaSelectionInTerminal } = await import("#src/cli/schema/terminal-schema-review.js");
      const result = reviewSchemaSelectionInTerminal(review);
      await vi.waitFor(() => expect(input.listenerCount("keypress")).toBe(1));

      input.emit("keypress", "/", { name: "slash", sequence: "/" });
      input.emit("keypress", "r", { name: "r", sequence: "r" });
      input.emit("keypress", "e", { name: "e", sequence: "e" });
      input.emit("keypress", "c", { name: "c", sequence: "c" });
      input.emit("keypress", "", { name: "return", sequence: "\r" });
      input.emit("keypress", "", { name: "space", sequence: " " });
      input.emit("keypress", "", { name: "return", sequence: "\r" });

      expect(await result).toMatchInlineSnapshot(`
        {
          "confirmRemoved": true,
          "selected": [
            "alpha.event",
            "alpha.record",
          ],
        }
      `);
      expect({
         emitKeypressEvents: emitKeypressEvents.mock.calls.length,
         listenerCount: input.listenerCount("keypress"),
         pause: input.pause.mock.calls.length,
         rawModes: input.setRawMode.mock.calls,
         renderCount: output.write.mock.calls.length,
         resume: input.resume.mock.calls.length,
         firstWrite: output.write.mock.calls[0],
         lastWrite: output.write.mock.calls.at(-1),
      }).toMatchInlineSnapshot(`
        {
          "emitKeypressEvents": 1,
          "firstWrite": [
            "[?25l",
          ],
          "lastWrite": [
            "[?25h
        ",
          ],
          "listenerCount": 0,
          "pause": 1,
          "rawModes": [
            [
              true,
            ],
            [
              false,
            ],
          ],
          "renderCount": 9,
          "resume": 1,
        }
      `);
   });

   test("pauses stdin after saving when its initial flow state is indeterminate", async () => {
      const { reviewSchemaSelectionInTerminal } = await import("#src/cli/schema/terminal-schema-review.js");
      input.pause.mockClear();
      input.resume.mockClear();

      const result = reviewSchemaSelectionInTerminal(review);
      await vi.waitFor(() => expect(input.listenerCount("keypress")).toBe(1));
      input.emit("keypress", "", { name: "return", sequence: "\r" });
      await result;

      expect({ pause: input.pause.mock.calls.length, resume: input.resume.mock.calls.length }).toMatchInlineSnapshot(`
        {
          "pause": 1,
          "resume": 1,
        }
      `);
   });

   test("rejects interactive selection outside a TTY", async () => {
      const { reviewSchemaSelectionInTerminal } = await import("#src/cli/schema/terminal-schema-review.js");
      input.isTTY = false;
      await expect(reviewSchemaSelectionInTerminal(review)).rejects.toThrowErrorMatchingInlineSnapshot(
         `[SchemaSelectionError: Interactive schema selection requires a TTY. Use --include, --exclude, or --all for non-interactive selection.]`,
      );
      input.isTTY = true;
   });
});
