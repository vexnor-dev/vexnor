import { emitKeypressEvents } from "node:readline";
import { stdin, stdout } from "node:process";
import {
   SchemaSelectionError,
   type SchemaSelectionReview,
   type SchemaSelectionReviewObject,
} from "#src/schema/schema-selection.js";

type TerminalSchemaReviewKey = {
   name?: string;
   sequence?: string;
   ctrl?: boolean;
};

export type TerminalSchemaReviewIo = {
   pageSize?: number;
   render(lines: readonly string[]): void;
   readKey(): Promise<TerminalSchemaReviewKey>;
   close?(): void;
};

type SelectionFilter = "all" | "checked" | "unchecked";
type SelectionMode = "navigation" | "search";

export async function reviewSchemaSelectionInTerminal(
   review: SchemaSelectionReview,
   suppliedIo?: TerminalSchemaReviewIo,
): Promise<{ selected: string[]; confirmRemoved: boolean }> {
   const io = suppliedIo ?? createTerminalSchemaReviewIo();
   const selected = new Set(review.objects.filter((object) => object.selected).map((object) => object.id));
   let filter: SelectionFilter = "all";
   let search = "";
   let mode: SelectionMode = "navigation";
   let cursor = 0;

   try {
      while (true) {
         const visible = filterObjects(review.objects, selected, filter, search);
         cursor = normalizeCursor(cursor, visible.length);
         io.render(renderSelection(review, visible, selected, cursor, filter, search, mode, io.pageSize));

         const key = await io.readKey();
         if (key.ctrl && key.name === "c") throw new SchemaSelectionError("Schema selection cancelled");

         if (mode === "search") {
            if (key.name === "escape") {
               search = "";
               mode = "navigation";
               cursor = 0;
            } else if (key.name === "return" || key.name === "enter") {
               mode = "navigation";
               cursor = 0;
            } else if (key.name === "backspace") {
               search = [...search].slice(0, -1).join("");
               cursor = 0;
            } else if (isPrintableKey(key)) {
               search += key.sequence;
               cursor = 0;
            }
            continue;
         }

         if (key.name === "up") {
            cursor = normalizeCursor(cursor - 1, visible.length);
         } else if (key.name === "down") {
            cursor = normalizeCursor(cursor + 1, visible.length);
         } else if (key.name === "space") {
            const current = visible[cursor];
            if (current) toggleObject(selected, current.id);
         } else if (key.name === "tab") {
            filter = nextFilter(filter);
            cursor = 0;
         } else if (key.name === "a") {
            toggleVisibleObjects(selected, visible);
            cursor = 0;
         } else if (key.name === "slash" || key.sequence === "/") {
            mode = "search";
            cursor = 0;
         } else if (key.name === "escape") {
            if (search) {
               search = "";
               cursor = 0;
            } else {
               throw new SchemaSelectionError("Schema selection cancelled");
            }
         } else if (key.name === "return" || key.name === "enter") {
            const confirmRemoved = await confirmRemovedObjects(review, io);
            return { selected: [...selected].sort(), confirmRemoved };
         }
      }
   } finally {
      io.close?.();
   }
}

function filterObjects(
   objects: readonly SchemaSelectionReviewObject[],
   selected: ReadonlySet<string>,
   filter: SelectionFilter,
   search: string,
): SchemaSelectionReviewObject[] {
   const normalizedSearch = search.trim().toLowerCase();
   return objects.filter((object) => {
      const isSelected = selected.has(object.id);
      if (filter === "checked" && !isSelected) return false;
      if (filter === "unchecked" && isSelected) return false;
      if (!normalizedSearch) return true;
      return `${object.schema} ${object.name} ${object.id} ${object.kind}`.toLowerCase().includes(normalizedSearch);
   });
}

function renderSelection(
   review: SchemaSelectionReview,
   visible: readonly SchemaSelectionReviewObject[],
   selected: ReadonlySet<string>,
   cursor: number,
   filter: SelectionFilter,
   search: string,
   mode: SelectionMode,
   pageSize?: number,
): string[] {
   const resolvedPageSize = Math.max(1, pageSize ?? (visible.length || 1));
   const pageStart = Math.floor(cursor / resolvedPageSize) * resolvedPageSize;
   const page = visible.slice(pageStart, pageStart + resolvedPageSize);
   const lines = [
      review.firstRun
         ? "First schema review: all discovered objects start selected."
         : "Schema review: prior selections are restored; newly discovered objects start unselected.",
      `Showing ${visible.length}/${review.objects.length} · Selected ${selected.size}/${review.objects.length} · Filter: ${filter}`,
      `Search: ${search}${mode === "search" ? "▌" : ""}`,
      "",
   ];

   let previousSchema: string | undefined;
   for (const [index, object] of page.entries()) {
      if (object.schema !== previousSchema) {
         lines.push(`Schema ${object.schema}`);
         previousSchema = object.schema;
      }
      const pointer = pageStart + index === cursor ? ">" : " ";
      const marker = selected.has(object.id) ? "x" : " ";
      const status = object.status === "new" ? " NEW" : "";
      lines.push(`${pointer} [${marker}] ${object.kind} ${object.id}${status}`);
   }
   if (visible.length === 0) {
      lines.push("No schema objects match the active filters.");
   } else if (page.length < visible.length) {
      lines.push(`Objects ${pageStart + 1}-${pageStart + page.length} of ${visible.length}`);
   }

   if (review.removedObjects.length > 0) {
      lines.push("", "Removed objects pending confirmation:");
      for (const object of review.removedObjects) lines.push(`  [-] ${object.kind} ${object.id}`);
   }

   lines.push(
      "",
      mode === "search"
         ? "Type to filter · Backspace edit · Enter apply · Esc clear"
         : "↑/↓ navigate · Space toggle · a toggle visible · Tab checked filter · / search · Enter save · Esc cancel",
   );
   return lines;
}

async function confirmRemovedObjects(review: SchemaSelectionReview, io: TerminalSchemaReviewIo): Promise<boolean> {
   if (review.removedObjects.length === 0) return true;
   io.render([
      "Removed objects pending confirmation:",
      ...review.removedObjects.map((object) => `  [-] ${object.kind} ${object.id}`),
      "",
      "Prune these removed objects from local selection state? y/N",
   ]);
   const key = await io.readKey();
   if (key.name === "y" || key.sequence?.toLowerCase() === "y") return true;
   throw new SchemaSelectionError("Removed schema objects were not confirmed for pruning");
}

function normalizeCursor(cursor: number, length: number): number {
   if (length === 0) return 0;
   if (cursor < 0) return length - 1;
   if (cursor >= length) return 0;
   return cursor;
}

function nextFilter(filter: SelectionFilter): SelectionFilter {
   if (filter === "all") return "checked";
   if (filter === "checked") return "unchecked";
   return "all";
}

function toggleObject(selected: Set<string>, id: string): void {
   if (selected.has(id)) selected.delete(id);
   else selected.add(id);
}

function toggleVisibleObjects(selected: Set<string>, visible: readonly SchemaSelectionReviewObject[]): void {
   const selectVisible = visible.some((object) => !selected.has(object.id));
   for (const object of visible) {
      if (selectVisible) selected.add(object.id);
      else selected.delete(object.id);
   }
}

function isPrintableKey(key: TerminalSchemaReviewKey): key is TerminalSchemaReviewKey & { sequence: string } {
   return key.ctrl !== true && typeof key.sequence === "string" && [...key.sequence].length === 1;
}

function createTerminalSchemaReviewIo(): TerminalSchemaReviewIo {
   if (!stdin.isTTY || !stdout.isTTY || typeof stdin.setRawMode !== "function") {
      throw new SchemaSelectionError(
         "Interactive schema selection requires a TTY. Use --include, --exclude, or --all for non-interactive selection.",
      );
   }

   emitKeypressEvents(stdin);
   const wasRaw = stdin.isRaw;
   const wasPaused = stdin.isPaused();
   const queuedKeys: TerminalSchemaReviewKey[] = [];
   const waitingReaders: Array<(key: TerminalSchemaReviewKey) => void> = [];
   const onKeypress = (_input: string | undefined, key: TerminalSchemaReviewKey) => {
      const reader = waitingReaders.shift();
      if (reader) reader(key);
      else queuedKeys.push(key);
   };
   stdin.on("keypress", onKeypress);
   stdin.setRawMode(true);
   stdin.resume();
   stdout.write("\u001B[?25l");

   return {
      pageSize: Math.max(3, (stdout.rows ?? 24) - 12),
      render(lines) {
         stdout.write(`\u001B[2J\u001B[H${lines.join("\n")}\n`);
      },
      readKey() {
         const queued = queuedKeys.shift();
         if (queued) return Promise.resolve(queued);
         return new Promise((resolve) => {
            waitingReaders.push(resolve);
         });
      },
      close() {
         stdin.off("keypress", onKeypress);
         stdin.setRawMode(wasRaw);
         if (wasPaused) stdin.pause();
         stdout.write("\u001B[?25h\n");
      },
   };
}
