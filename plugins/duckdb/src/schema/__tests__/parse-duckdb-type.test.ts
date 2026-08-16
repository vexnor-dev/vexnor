import { describe, expect, test } from "vitest";
import { parseDuckDBType } from "#src/schema/parse-duckdb-type.js";

describe("parseDuckDBType", () => {
   test("parses every scalar family inside nested DuckDB types", () => {
      const types = [
         "BOOLEAN", "BOOL", "LOGICAL",
         "TINYINT", "SMALLINT", "INTEGER", "INT", "UTINYINT", "USMALLINT", "UINTEGER", "FLOAT", "REAL", "DOUBLE",
         "BIGINT", "HUGEINT", "UBIGINT", "UHUGEINT", "BIGNUM",
         "DECIMAL", "NUMERIC", "DECIMAL(18,4)", "NUMERIC(18,4)",
         "VARCHAR", "TEXT", "CHAR", "BPCHAR", "STRING", "UUID", "TIME", "TIME WITH TIME ZONE", "TIMETZ", "INTERVAL", "BIT", "GEOMETRY",
         "BLOB", "BYTEA", "BINARY", "VARBINARY",
         "DATE", "TIMESTAMP", "TIMESTAMP_S", "TIMESTAMP_MS", "TIMESTAMP_NS", "TIMESTAMP WITH TIME ZONE", "TIMESTAMPTZ",
         "JSON", "ENUM('open', 'it''s')", "UNKNOWN_TYPE",
      ];

      expect(Object.fromEntries(types.map((type) => [type, parseDuckDBType(`${type}[]`)]))).toMatchInlineSnapshot(`
        {
          "BIGINT": {
            "kind": "list",
            "value": {
              "kind": "scalar",
              "type": "BigInt",
            },
          },
          "BIGNUM": {
            "kind": "list",
            "value": {
              "kind": "scalar",
              "type": "BigInt",
            },
          },
          "BINARY": {
            "kind": "list",
            "value": {
              "kind": "scalar",
              "type": "Uint8Array",
            },
          },
          "BIT": {
            "kind": "list",
            "value": {
              "kind": "scalar",
              "type": "string",
            },
          },
          "BLOB": {
            "kind": "list",
            "value": {
              "kind": "scalar",
              "type": "Uint8Array",
            },
          },
          "BOOL": {
            "kind": "list",
            "value": {
              "kind": "scalar",
              "type": "boolean",
            },
          },
          "BOOLEAN": {
            "kind": "list",
            "value": {
              "kind": "scalar",
              "type": "boolean",
            },
          },
          "BPCHAR": {
            "kind": "list",
            "value": {
              "kind": "scalar",
              "type": "string",
            },
          },
          "BYTEA": {
            "kind": "list",
            "value": {
              "kind": "scalar",
              "type": "Uint8Array",
            },
          },
          "CHAR": {
            "kind": "list",
            "value": {
              "kind": "scalar",
              "type": "string",
            },
          },
          "DATE": {
            "kind": "list",
            "value": {
              "kind": "scalar",
              "type": "Date",
            },
          },
          "DECIMAL": {
            "kind": "list",
            "value": {
              "kind": "scalar",
              "type": "string",
            },
          },
          "DECIMAL(18,4)": {
            "kind": "list",
            "value": {
              "kind": "scalar",
              "type": "string",
            },
          },
          "DOUBLE": {
            "kind": "list",
            "value": {
              "kind": "scalar",
              "type": "number",
            },
          },
          "ENUM('open', 'it''s')": {
            "kind": "list",
            "value": {
              "kind": "scalar",
              "type": "Udt",
              "udt": "ENUM('open', 'it''s')",
            },
          },
          "FLOAT": {
            "kind": "list",
            "value": {
              "kind": "scalar",
              "type": "number",
            },
          },
          "GEOMETRY": {
            "kind": "list",
            "value": {
              "kind": "scalar",
              "type": "string",
            },
          },
          "HUGEINT": {
            "kind": "list",
            "value": {
              "kind": "scalar",
              "type": "BigInt",
            },
          },
          "INT": {
            "kind": "list",
            "value": {
              "kind": "scalar",
              "type": "number",
            },
          },
          "INTEGER": {
            "kind": "list",
            "value": {
              "kind": "scalar",
              "type": "number",
            },
          },
          "INTERVAL": {
            "kind": "list",
            "value": {
              "kind": "scalar",
              "type": "string",
            },
          },
          "JSON": {
            "kind": "list",
            "value": {
              "kind": "scalar",
              "type": "Json",
            },
          },
          "LOGICAL": {
            "kind": "list",
            "value": {
              "kind": "scalar",
              "type": "boolean",
            },
          },
          "NUMERIC": {
            "kind": "list",
            "value": {
              "kind": "scalar",
              "type": "string",
            },
          },
          "NUMERIC(18,4)": {
            "kind": "list",
            "value": {
              "kind": "scalar",
              "type": "string",
            },
          },
          "REAL": {
            "kind": "list",
            "value": {
              "kind": "scalar",
              "type": "number",
            },
          },
          "SMALLINT": {
            "kind": "list",
            "value": {
              "kind": "scalar",
              "type": "number",
            },
          },
          "STRING": {
            "kind": "list",
            "value": {
              "kind": "scalar",
              "type": "string",
            },
          },
          "TEXT": {
            "kind": "list",
            "value": {
              "kind": "scalar",
              "type": "string",
            },
          },
          "TIME": {
            "kind": "list",
            "value": {
              "kind": "scalar",
              "type": "string",
            },
          },
          "TIME WITH TIME ZONE": {
            "kind": "list",
            "value": {
              "kind": "scalar",
              "type": "string",
            },
          },
          "TIMESTAMP": {
            "kind": "list",
            "value": {
              "kind": "scalar",
              "type": "Date",
            },
          },
          "TIMESTAMP WITH TIME ZONE": {
            "kind": "list",
            "value": {
              "kind": "scalar",
              "type": "Date",
            },
          },
          "TIMESTAMPTZ": {
            "kind": "list",
            "value": {
              "kind": "scalar",
              "type": "Date",
            },
          },
          "TIMESTAMP_MS": {
            "kind": "list",
            "value": {
              "kind": "scalar",
              "type": "Date",
            },
          },
          "TIMESTAMP_NS": {
            "kind": "list",
            "value": {
              "kind": "scalar",
              "type": "Date",
            },
          },
          "TIMESTAMP_S": {
            "kind": "list",
            "value": {
              "kind": "scalar",
              "type": "Date",
            },
          },
          "TIMETZ": {
            "kind": "list",
            "value": {
              "kind": "scalar",
              "type": "string",
            },
          },
          "TINYINT": {
            "kind": "list",
            "value": {
              "kind": "scalar",
              "type": "number",
            },
          },
          "UBIGINT": {
            "kind": "list",
            "value": {
              "kind": "scalar",
              "type": "BigInt",
            },
          },
          "UHUGEINT": {
            "kind": "list",
            "value": {
              "kind": "scalar",
              "type": "BigInt",
            },
          },
          "UINTEGER": {
            "kind": "list",
            "value": {
              "kind": "scalar",
              "type": "number",
            },
          },
          "UNKNOWN_TYPE": {
            "kind": "list",
            "value": {
              "kind": "scalar",
              "type": "unknown",
            },
          },
          "USMALLINT": {
            "kind": "list",
            "value": {
              "kind": "scalar",
              "type": "number",
            },
          },
          "UTINYINT": {
            "kind": "list",
            "value": {
              "kind": "scalar",
              "type": "number",
            },
          },
          "UUID": {
            "kind": "list",
            "value": {
              "kind": "scalar",
              "type": "string",
            },
          },
          "VARBINARY": {
            "kind": "list",
            "value": {
              "kind": "scalar",
              "type": "Uint8Array",
            },
          },
          "VARCHAR": {
            "kind": "list",
            "value": {
              "kind": "scalar",
              "type": "string",
            },
          },
        }
      `);
   });

   test("parses quoted fields, escaped quotes, fixed arrays, maps, unions, and empty structs", () => {
      expect([
         parseDuckDBType('STRUCT("display name" VARCHAR, "quote""name" INTEGER)'),
         parseDuckDBType("INTEGER[2][]"),
         parseDuckDBType("MAP(VARCHAR, STRUCT(value DOUBLE))"),
         parseDuckDBType("UNION(number INTEGER, text VARCHAR)"),
         parseDuckDBType("STRUCT()"),
         parseDuckDBType("STRUCT"),
         parseDuckDBType("MAP"),
         parseDuckDBType("UNION"),
      ]).toMatchInlineSnapshot(`
        [
          {
            "fields": [
              {
                "name": "display name",
                "value": {
                  "kind": "scalar",
                  "type": "string",
                },
              },
              {
                "name": "quote"name",
                "value": {
                  "kind": "scalar",
                  "type": "number",
                },
              },
            ],
            "kind": "struct",
          },
          {
            "kind": "list",
            "value": {
              "kind": "list",
              "length": 2,
              "value": {
                "kind": "scalar",
                "type": "number",
              },
            },
          },
          {
            "key": {
              "kind": "scalar",
              "type": "string",
            },
            "kind": "map",
            "value": {
              "fields": [
                {
                  "name": "value",
                  "value": {
                    "kind": "scalar",
                    "type": "number",
                  },
                },
              ],
              "kind": "struct",
            },
          },
          {
            "kind": "union",
            "members": [
              {
                "name": "number",
                "value": {
                  "kind": "scalar",
                  "type": "number",
                },
              },
              {
                "name": "text",
                "value": {
                  "kind": "scalar",
                  "type": "string",
                },
              },
            ],
          },
          {
            "fields": [],
            "kind": "struct",
          },
          {
            "kind": "scalar",
            "type": "unknown",
          },
          {
            "kind": "scalar",
            "type": "unknown",
          },
          {
            "kind": "scalar",
            "type": "unknown",
          },
        ]
      `);
   });

   test("reports malformed DuckDB type syntax precisely", () => {
      const invalid = [
         "INTEGER)",
         "STRUCT(, VARCHAR)",
         'STRUCT("unterminated VARCHAR)',
         "MAP(VARCHAR INTEGER)",
         "MAP(VARCHAR, INTEGER",
         "STRUCT(name)",
      ];

      expect(Object.fromEntries(invalid.map((type) => {
         try {
            parseDuckDBType(type);
            return [type, "no error"];
         } catch (error) {
            return [type, error instanceof Error ? error.message : String(error)];
         }
      }))).toMatchInlineSnapshot(`
        {
          "INTEGER)": "Unexpected DuckDB type syntax at position 7: INTEGER)",
          "MAP(VARCHAR INTEGER)": "Expected "," at position 19: MAP(VARCHAR INTEGER)",
          "MAP(VARCHAR, INTEGER": "Expected ")" at position 20: MAP(VARCHAR, INTEGER",
          "STRUCT("unterminated VARCHAR)": "Unterminated DuckDB identifier: STRUCT("unterminated VARCHAR)",
          "STRUCT(, VARCHAR)": "Missing DuckDB field name at position 7: STRUCT(, VARCHAR)",
          "STRUCT(name)": "Missing DuckDB type at position 11: STRUCT(name)",
        }
      `);
   });
});
