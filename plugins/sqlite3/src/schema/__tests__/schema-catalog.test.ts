import { createSchemaCatalog } from "@vexnor/core/schema";
import type { SqlSchema } from "@vexnor/core/plugin";
import { describe, expect, test } from "vitest";
import { VexnorSqlite3 } from "#src/vexnor-sqlite3.js";

describe("SQLite schema catalog", () => {
   test("normalizes introspection through the SQLite type mapper", () => {
      const schema = {
         enums: [],
         tables: [
            {
               table_schema: "main",
               table_name: "record",
               table_type: "table",
               columns: [
                  {
                     table_schema: "main",
                     table_name: "record",
                     column_name: "record_id",
                     column_default: null,
                     is_nullable: "NO",
                     is_updatable: "YES",
                     ordinal_position: 1,
                     udt_name: "INTEGER",
                  },
               ],
               primary_keys: [
                  {
                     table_schema: "main",
                     table_name: "record",
                     constraint_name: "primary",
                     column_name: "record_id",
                     ordinal_position: 1,
                  },
               ],
               foreign_keys: [],
            },
         ],
      } satisfies SqlSchema;

      expect(createSchemaCatalog({ plugin: new VexnorSqlite3(), schema })).toMatchInlineSnapshot(`
        {
          "enums": [],
          "fingerprint": "34b39e0f94bfe9bbe325fab362db3a11531486de2fa1e37860bb550a144c46f5",
          "formatVersion": 1,
          "objects": [
            {
              "capabilities": {
                "automaticJoin": false,
                "deletable": true,
                "insertable": true,
                "readable": true,
                "stableIdentity": true,
                "updatable": true,
              },
              "columns": [
                {
                  "array": false,
                  "customType": null,
                  "dataType": null,
                  "default": null,
                  "domainName": null,
                  "generated": false,
                  "generationExpression": null,
                  "id": "main.record.record_id",
                  "identity": false,
                  "identityGeneration": null,
                  "mappingName": "record_id",
                  "nativeType": "INTEGER",
                  "normalizedType": "number",
                  "nullable": false,
                  "ordinalPosition": 1,
                  "physicalName": "record_id",
                  "typeTree": null,
                  "updatable": true,
                  "warnings": [],
                },
              ],
              "id": "main.record",
              "kind": "table",
              "mappingName": "Record",
              "name": "record",
              "primaryKey": {
                "columns": [
                  "record_id",
                ],
                "constraintName": "primary",
              },
              "relationships": [],
              "schema": "main",
              "warnings": [],
            },
          ],
          "plugin": {
            "dialect": "sqlite",
            "driver": "better-sqlite3",
            "name": "@vexnor/sqlite3",
            "version": "1.0.0-beta.3",
          },
          "schemas": [
            "main",
          ],
          "warnings": [],
        }
      `);
   });
});
