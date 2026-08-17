import { describe, expect, test } from "vitest";
import { newSqlTable } from "#src/core/schema/sql-table.js";
import { serializeSchema } from "#src/core/serialize/serialize-schema.js";

type RuntimeMetadata = {
   catalogId: string;
   objectKind: "table" | "view";
};

function runtimeTable({
   name,
   kind,
   pk,
   fk = [],
}: {
   name: string;
   kind: RuntimeMetadata["objectKind"];
   pk: Array<"tenantId" | "recordId">;
   fk?: Array<{
      from: string[];
      to: { schema: string; table: string; columns: string[] };
   }>;
}) {
   return newSqlTable<{
      Select: { tenantId: string; recordId: string };
      Insert: Record<string, unknown>;
      Update: Record<string, unknown>;
      Delete: true;
      Source: "test";
   }, RuntimeMetadata>({
      crud: { select: true, insert: true, update: true, delete: true },
      tableInfo: { name, schema: "alpha", alias: null, out: false },
      pk,
      source: "test",
      fk,
      columns: { tenantId: "tenant_id", recordId: "record_id" },
      dbSchema: {
         tenantId: { dbType: "text", type: "string" },
         recordId: { dbType: "text", type: "string" },
      },
   }, { catalogId: `alpha.${name}`, objectKind: kind });
}

describe("serializeSchema inclusion", () => {
   const RecordTable = runtimeTable({
      name: "record",
      kind: "table",
      pk: ["tenantId", "recordId"],
   });
   const EventLog = runtimeTable({
      name: "event_log",
      kind: "table",
      pk: [],
      fk: [{
         from: ["tenantId", "recordId"],
         to: { schema: "alpha", table: "record", columns: ["tenantId", "recordId"] },
      }],
   });
   const EventView = runtimeTable({ name: "event_view", kind: "view", pk: [] });
   const schema = { RecordTable, EventLog, EventView };

   test("keeps stable-identity filtering as the default regardless of catalog metadata", () => {
      expect(serializeSchema(schema, "sqlite")).toMatchInlineSnapshot(`
        {
          "dialect": "sqlite",
          "tables": {
            "alpha.record": {
              "columns": [
                {
                  "name": "tenantId",
                  "type": "text",
                },
                {
                  "name": "recordId",
                  "type": "text",
                },
              ],
              "fk": [],
              "kind": "table",
              "pk": [
                "tenantId",
                "recordId",
              ],
            },
          },
          "version": 1,
        }
      `);
   });

   test("preserves readable object kinds and complete composite relationships when requested", () => {
      const result = serializeSchema(schema, "sqlite", { include: "all-readable" });

      expect({
         tables: Object.keys(result.tables),
         kinds: Object.fromEntries(Object.entries(result.tables).map(([id, table]) => [id, table.kind])),
         eventForeignKeys: result.tables["alpha.event_log"]?.fk,
      }).toMatchInlineSnapshot(`
        {
          "eventForeignKeys": [
            {
              "column": "tenantId",
              "columns": [
                "tenantId",
                "recordId",
              ],
              "targetColumn": "tenantId",
              "targetColumns": [
                "tenantId",
                "recordId",
              ],
              "targetTable": "alpha.record",
            },
          ],
          "kinds": {
            "alpha.event_log": "table",
            "alpha.event_view": "view",
            "alpha.record": "table",
          },
          "tables": [
            "alpha.event_log",
            "alpha.event_view",
            "alpha.record",
          ],
        }
      `);
   });
});
