import { newSqlTable, type SqlTableForeignKey } from "#src/core/schema/sql-table.js";
import { SchemaGraph } from "#src/execution/schema-graph.js";
import { describe, expect, test } from "vitest";

function makeTable(name: string, columns: Record<string, string>, opts?: { fk?: SqlTableForeignKey[]; pk?: string[]; schema?: string }) {
   return newSqlTable<{ Select: Record<string, unknown>; Insert: Record<string, unknown>; Update: Record<string, unknown>; Delete: true; Source: "test" }>({
      crud: { select: true, insert: true, update: true, delete: true },
      tableInfo: { name, schema: opts?.schema ?? "test_schema", alias: null, out: false },
      pk: (opts?.pk ?? [`${name}Id`]) as never[],
      source: "test",
      fk: opts?.fk,
      columns: columns as never,
   });
}

describe("SchemaGraph connected target joins", () => {
   test("resolves later targets from the existing join tree instead of unrelated sibling branches", () => {
      const RootEntity = makeTable("root_entity", { rootId: "root_id" }, { pk: ["rootId"] });
      const PrimaryLink = makeTable("primary_link", { primaryLinkId: "primary_link_id", rootId: "root_id", sharedTargetId: "shared_target_id" }, {
         pk: ["primaryLinkId"],
         fk: [
            { from: ["rootId"], to: { schema: "test_schema", table: "root_entity", columns: ["rootId"] } },
            { from: ["sharedTargetId"], to: { schema: "test_schema", table: "shared_target", columns: ["sharedTargetId"] } },
         ],
      });
      const AlternateLink = makeTable("alternate_link", { alternateLinkId: "alternate_link_id", rootId: "root_id", sharedTargetId: "shared_target_id" }, {
         pk: ["alternateLinkId"],
         fk: [
            { from: ["rootId"], to: { schema: "test_schema", table: "root_entity", columns: ["rootId"] } },
            { from: ["sharedTargetId"], to: { schema: "test_schema", table: "shared_target", columns: ["sharedTargetId"] } },
         ],
      });
      const SharedTarget = makeTable("shared_target", { sharedTargetId: "shared_target_id" }, { pk: ["sharedTargetId"] });
      const graph = new SchemaGraph({ RootEntity, PrimaryLink, AlternateLink, SharedTarget });

      const result = graph.joinBy("test_schema.root_entity", [
         { table: "test_schema.primary_link" },
         { table: "test_schema.shared_target" },
      ]);

      expect(result?.joinBy).toMatchInlineSnapshot(`
        {
          "primary_link": {
            "on": [
              [
                "root_entity.rootId",
                "=",
                "primary_link.rootId",
              ],
            ],
          },
          "shared_target": {
            "on": [
              [
                "primary_link.sharedTargetId",
                "=",
                "shared_target.sharedTargetId",
              ],
            ],
          },
        }
      `);
      expect(result?.tables).toMatchInlineSnapshot(`
        [
          "test_schema.root_entity",
          "test_schema.primary_link",
          "test_schema.shared_target",
        ]
      `);
   });
});
