import { describe, expect, test } from "vitest";
import { dateValue, DuckDBConnection, DuckDBTypeId } from "@duckdb/node-api";
import { bindDuckDBValue, hasComplexDuckDBValues, toDuckDBValue } from "#src/duckdb-values.js";

describe("DuckDB parameter conversion", () => {
   test("detects values that require prepared-statement binding", () => {
      expect([
         hasComplexDuckDBValues([null, true, 1, 1n, "text"]),
         hasComplexDuckDBValues([new Date()]),
         hasComplexDuckDBValues([new Uint8Array([1])]),
      ]).toMatchInlineSnapshot(`
        [
          false,
          true,
          true,
        ]
      `);
   });

   test("converts every supported JavaScript value family", () => {
      const values = [
         null,
         true,
         42,
         42n,
         "duck",
         new Date("2026-08-10T12:34:56.789Z"),
         new Uint8Array([1, 2]),
         [1, "two"],
         new Map([["one", 1]]),
         { nested: true },
         Object.assign(Object.create(null), { key: "value" }),
         dateValue(1),
      ];

      expect(values.map((value) => {
         const converted = toDuckDBValue(value);
         return converted === null || typeof converted !== "object" ? typeof converted : converted.constructor.name;
      })).toMatchInlineSnapshot(`
        [
          "object",
          "boolean",
          "number",
          "bigint",
          "string",
          "DuckDBTimestampMillisecondsValue",
          "DuckDBBlobValue",
          "DuckDBListValue",
          "DuckDBMapValue",
          "DuckDBStructValue",
          "DuckDBStructValue",
          "DuckDBDateValue",
        ]
      `);
   });

   test("rejects undefined and unsupported object values", () => {
      expect(() => toDuckDBValue(undefined)).toThrowErrorMatchingInlineSnapshot(
         `[TypeError: Undefined cannot be bound as a DuckDB parameter; use null for SQL NULL]`,
      );
      expect(() => toDuckDBValue(new URL("https://duckdb.org"))).toThrowErrorMatchingInlineSnapshot(
         `[TypeError: Unsupported DuckDB parameter value: [object URL]]`,
      );
   });

   test("binds null, binary, JSON, collections, and every timestamp precision", async () => {
      const connection = await DuckDBConnection.create();
      try {
         const cases: [string, unknown][] = [
            ["INTEGER", null],
            ["INTEGER", undefined],
            ["BLOB", new Uint8Array([1, 2, 3])],
            ["JSON", { answer: 42 }],
            ["INTEGER[]", [1, 2]],
            ["MAP(VARCHAR, INTEGER)", new Map([["one", 1]])],
            ["STRUCT(answer INTEGER)", { answer: 42 }],
            ["DATE", new Date("2026-08-10T00:00:00.000Z")],
            ["TIMESTAMP_S", new Date("2026-08-10T12:34:56.000Z")],
            ["TIMESTAMP_MS", new Date("2026-08-10T12:34:56.789Z")],
            ["TIMESTAMP_NS", new Date("2026-08-10T12:34:56.789Z")],
            ["TIMESTAMP WITH TIME ZONE", new Date("2026-08-10T12:34:56.789Z")],
            ["TIMESTAMP", new Date("2026-08-10T12:34:56.789Z")],
         ];
         const outputs: unknown[] = [];

         for (const [type, value] of cases) {
            const statement = await connection.prepare(`select $1::${type} as value`);
            try {
               bindDuckDBValue(statement, 1, value);
               const reader = await statement.runAndReadAll();
               outputs.push(reader.getRowsJS()[0]![0]);
            } finally {
               statement.destroySync();
            }
         }

         expect(outputs).toMatchInlineSnapshot(`
           [
             null,
             null,
             {
               "data": [
                 1,
                 2,
                 3,
               ],
               "type": "Buffer",
             },
             "{"answer":42}",
             [
               1,
               2,
             ],
             [
               {
                 "key": "one",
                 "value": 1,
               },
             ],
             {
               "answer": 42,
             },
             2026-08-10T00:00:00.000Z,
             2026-08-10T12:34:56.000Z,
             2026-08-10T12:34:56.789Z,
             2026-08-10T12:34:56.789Z,
             2026-08-10T12:34:56.789Z,
             2026-08-10T12:34:56.789Z,
           ]
         `);

      } finally {
         connection.closeSync();
      }
   });

   test("binds generated string representations through native DuckDB casts", async () => {
      const connection = await DuckDBConnection.create();
      try {
         const cases: [string, string][] = [
            ["DECIMAL(18,4)", "12345678901234.5678"],
            ["TIME", "12:34:56.789"],
            ["INTERVAL", "1 year 2 months 3 days 04:05:06"],
            ["BIT", "10101010"],
            ["UUID", "12345678-1234-5678-1234-567812345678"],
         ];
         const outputs: unknown[] = [];

         for (const [type, value] of cases) {
            const statement = await connection.prepare(`select $1::${type} as value`);
            try {
               bindDuckDBValue(statement, 1, value);
               const reader = await statement.runAndReadAll();
               outputs.push(reader.getRowsJS()[0]![0]);
            } finally {
               statement.destroySync();
            }
         }

         expect(outputs).toMatchInlineSnapshot(`
           [
             12345678901234.568,
             45296789000n,
             {
               "days": 3,
               "micros": 14706000000n,
               "months": 14,
             },
             Uint8Array [
               0,
               170,
             ],
             "12345678-1234-5678-1234-567812345678",
           ]
         `);
      } finally {
         connection.closeSync();
      }
   });

   test("omits an explicit logical type when DuckDB reports an ANY parameter", () => {
      const calls: unknown[][] = [];
      const statement = {
         parameterType() {
            return { typeId: DuckDBTypeId.ANY };
         },
         bindValue(...args: unknown[]) {
            calls.push(args);
         },
      };

      Reflect.apply(bindDuckDBValue, undefined, [statement, 1, [1, 2]]);

      expect(calls.map((args) => args.length)).toMatchInlineSnapshot(`
        [
          3,
        ]
      `);
      expect(calls[0]![2]).toBeUndefined();
   });
});
