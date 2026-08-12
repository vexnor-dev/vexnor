import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import {
   SchemaSelectionError,
   type SchemaSelectionReview,
} from "#src/schema/schema-selection.js";

export type TerminalSchemaReviewIo = {
   write(message: string): void;
   prompt(message: string): Promise<string>;
};

export async function reviewSchemaSelectionInTerminal(
   review: SchemaSelectionReview,
   suppliedIo?: TerminalSchemaReviewIo,
): Promise<{ selected: string[]; confirmRemoved: boolean }> {
   const readline = suppliedIo ? undefined : createInterface({ input: stdin, output: stdout });
   const io: TerminalSchemaReviewIo = suppliedIo ?? {
      write: (message) => stdout.write(`${message}\n`),
      prompt: (message) => readline!.question(message),
   };
   const selected = new Set(review.objects.filter((object) => object.selected).map((object) => object.id));

   try {
      printReview(review, selected, io);
      while (true) {
         const answer = (await io.prompt("selection> ")).trim();
         if (answer === "save" || answer === "") {
            const confirmRemoved = await confirmRemovedObjects(review, io);
            return { selected: [...selected].sort(), confirmRemoved };
         }
         if (answer === "cancel") throw new SchemaSelectionError("Schema selection cancelled");
         if (answer === "list") {
            printReview(review, selected, io);
            continue;
         }
         if (answer === "all") {
            for (const object of review.objects) selected.add(object.id);
            continue;
         }
         if (answer === "none") {
            selected.clear();
            continue;
         }

         const [target, identity, operation, ...extra] = answer.split(/\s+/);
         if (extra.length > 0 || (target !== "schema" && target !== "object") || !identity || !isOperation(operation)) {
            io.write(`Invalid selection command: ${answer}`);
            continue;
         }

         const matchingObjects = target === "schema"
            ? review.objects.filter((object) => object.schema === identity)
            : review.objects.filter((object) => object.id === identity);
         if (matchingObjects.length === 0) {
            io.write(`Invalid selection command: ${answer}`);
            continue;
         }
         for (const object of matchingObjects) updateSelection(selected, object.id, operation);
      }
   } finally {
      readline?.close();
   }
}

function printReview(review: SchemaSelectionReview, selected: Set<string>, io: TerminalSchemaReviewIo): void {
   io.write(review.firstRun
      ? "First schema review: all discovered objects start selected."
      : "Schema review: prior selections are restored; newly discovered objects start unselected.");
   for (const schema of review.schemas) {
      io.write(`Schema ${schema}`);
      for (const object of review.objects.filter((object) => object.schema === schema)) {
         const marker = selected.has(object.id) ? "x" : " ";
         const status = object.status === "new" ? " NEW" : "";
         io.write(`  [${marker}] ${object.kind} ${object.id}${status}`);
      }
   }
   if (review.removedObjects.length > 0) {
      io.write("Removed objects pending confirmation:");
      for (const object of review.removedObjects) io.write(`  [-] ${object.kind} ${object.id}`);
   }
   io.write("Commands: all, none, schema <name> <on|off|toggle>, object <schema.name> <on|off|toggle>, list, save, cancel");
}

async function confirmRemovedObjects(review: SchemaSelectionReview, io: TerminalSchemaReviewIo): Promise<boolean> {
   if (review.removedObjects.length === 0) return true;
   const answer = (await io.prompt("Prune the removed objects from local selection state? Type 'yes' to confirm: ")).trim().toLowerCase();
   if (answer !== "yes") {
      throw new SchemaSelectionError("Removed schema objects were not confirmed for pruning");
   }
   return true;
}

function isOperation(value: string | undefined): value is "on" | "off" | "toggle" {
   return value === "on" || value === "off" || value === "toggle";
}

function updateSelection(selected: Set<string>, id: string, operation: "on" | "off" | "toggle"): void {
   if (operation === "on" || (operation === "toggle" && !selected.has(id))) {
      selected.add(id);
   } else {
      selected.delete(id);
   }
}
