import { describe, expect, test } from "vitest";
import { newSqlTable } from "#src/core/schema/sql-table.js";
import { SchemaGraph } from "#src/execution/schema-graph.js";

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

describe("SchemaGraph inclusion", () => {
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
   const Partition = runtimeTable({ name: "record_p2025_01", kind: "table", pk: ["tenantId", "recordId"] });
   const schema = { RecordTable, EventLog, EventView, Partition };

   test("keeps stable-identity filtering as the default regardless of catalog metadata", () => {
      expect(new SchemaGraph(schema).tables()).toMatchInlineSnapshot(`
        [
          "alpha.record",
        ]
      `);
   });

   test("includes every supplied readable mapping only when explicitly requested", () => {
      const graph = new SchemaGraph(schema, { include: "all-readable" });

      expect({
         tables: graph.tables(),
         pkless: graph.table("alpha.event_log"),
         view: graph.table("alpha.event_view"),
         path: graph.joinPath("alpha.event_log", "alpha.record"),
      }).toMatchInlineSnapshot(`
        {
          "path": [
            {
              "columnPairs": [
                {
                  "from": {
                    "column": "tenantId",
                    "schema": "alpha",
                    "table": "event_log",
                  },
                  "to": {
                    "column": "tenantId",
                    "schema": "alpha",
                    "table": "record",
                  },
                },
                {
                  "from": {
                    "column": "recordId",
                    "schema": "alpha",
                    "table": "event_log",
                  },
                  "to": {
                    "column": "recordId",
                    "schema": "alpha",
                    "table": "record",
                  },
                },
              ],
              "from": {
                "column": "tenantId",
                "schema": "alpha",
                "table": "event_log",
              },
              "to": {
                "column": "tenantId",
                "schema": "alpha",
                "table": "record",
              },
            },
          ],
          "pkless": {
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
            "fk": [
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
            "kind": "table",
            "name": "event_log",
            "pk": [],
            "schema": "alpha",
          },
          "tables": [
            "alpha.event_log",
            "alpha.event_view",
            "alpha.record",
            "alpha.record_p2025_01",
          ],
          "view": {
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
            "kind": "view",
            "name": "event_view",
            "pk": [],
            "schema": "alpha",
          },
        }
      `);
   });
});
