import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { params, row } from "@vexnor/core";
import { sql } from "@vexnor/duckdb";
import {
   TypeCoverage,
   type ITypeCoverageInsert,
   type ITypeCoverageSelect,
} from "./codegen/main.type_coverage-table.js";
import { db } from "./config.js";

describe("DuckDB native type coverage", { concurrent: false }, () => {
   let inserted: ITypeCoverageSelect;

   beforeAll(async () => {
      const values: ITypeCoverageInsert = {
         colBoolean: true,
         colTinyint: -8,
         colSmallint: -32000,
         colInteger: -2_000_000,
         colBigint: 9_007_199_254_740_991n,
         colHugeint: 123_456_789_012_345_678_901_234_567_890n,
         colUtinyint: 255,
         colUsmallint: 65_535,
         colUinteger: 4_000_000_000,
         colUbigint: 18_000_000_000_000_000_000n,
         colUhugeint: 123_456_789_012_345_678_901_234_567_890n,
         colReal: 1.5,
         colDouble: 3.141592653589793,
         colDecimal: "12345678901234.5678",
         colVarchar: "DuckDB text",
         colChar: "char value",
         colBlob: new Uint8Array([0, 1, 2, 255]),
         colBit: "10101010",
         colDate: new Date("2026-08-11T00:00:00.000Z"),
         colTime: "12:34:56.789",
         colTimestampS: new Date("2026-08-11T12:34:56.000Z"),
         colTimestampMs: new Date("2026-08-11T12:34:56.789Z"),
         colTimestamp: new Date("2026-08-11T12:34:56.789Z"),
         colTimestampNs: new Date("2026-08-11T12:34:56.789Z"),
         colTimestamptz: new Date("2026-08-11T12:34:56.789Z"),
         colInterval: "1 year 2 months 3 days 04:05:06",
         colJson: { nested: { value: true }, items: [1, 2] },
         colList: [1, 2, 3],
         colStruct: { name: "native", score: 42 },
         colMap: new Map([["one", 1], ["two", 2]]),
      };
      const input = params<ITypeCoverageInsert>();
      const query = sql`
         insert into ${TypeCoverage} (
            col_boolean, col_tinyint, col_smallint, col_integer, col_bigint, col_hugeint,
            col_utinyint, col_usmallint, col_uinteger, col_ubigint, col_uhugeint, col_real,
            col_double, col_decimal, col_varchar, col_char, col_blob, col_bit, col_date, col_time,
            col_timestamp_s, col_timestamp_ms, col_timestamp, col_timestamp_ns, col_timestamptz,
            col_interval, col_json, col_list, col_struct, col_map
         ) values (
            ${input.colBoolean}, ${input.colTinyint}, ${input.colSmallint}, ${input.colInteger},
            ${input.colBigint}, ${input.colHugeint}, ${input.colUtinyint}, ${input.colUsmallint},
            ${input.colUinteger}, ${input.colUbigint}, ${input.colUhugeint}, ${input.colReal},
            ${input.colDouble}, ${input.colDecimal}, ${input.colVarchar}, ${input.colChar},
            ${input.colBlob}, ${input.colBit}, ${input.colDate}, ${input.colTime}, ${input.colTimestampS},
            ${input.colTimestampMs}, ${input.colTimestamp}, ${input.colTimestampNs}, ${input.colTimestamptz},
            ${input.colInterval}, ${input.colJson}, [1, 2, 3], ${input.colStruct}, ${input.colMap}
         ) returning ${row(TypeCoverage.$$)}
      `;
      inserted = await query.duckdb.one({
         db,
         params: values,
      });
   });

   afterAll(async () => {
      if (!inserted) return;
      await sql`delete from ${TypeCoverage} where ${TypeCoverage.$colUuid} = ${inserted.colUuid}`.duckdb.run({ db });
   });

   test("round-trips every generated DuckDB column through prepared binding", () => {
      const { colUuid, ...stable } = inserted;

      expect(typeof colUuid).toBe("string");
      expect(stable).toMatchInlineSnapshot(`
        {
          "colBigint": 9007199254740991n,
          "colBit": Uint8Array [
            0,
            170,
          ],
          "colBlob": Uint8Array [
            0,
            1,
            2,
            255,
          ],
          "colBoolean": true,
          "colChar": "char value",
          "colDate": 2026-08-11T00:00:00.000Z,
          "colDecimal": 12345678901234.568,
          "colDouble": 3.141592653589793,
          "colHugeint": 123456789012345678901234567890n,
          "colInteger": -2000000,
          "colInterval": {
            "days": 3,
            "micros": 14706000000n,
            "months": 14,
          },
          "colJson": "{"nested":{"value":true},"items":[1,2]}",
          "colList": [
            1,
            2,
            3,
          ],
          "colMap": [
            {
              "key": "one",
              "value": 1,
            },
            {
              "key": "two",
              "value": 2,
            },
          ],
          "colReal": 1.5,
          "colSmallint": -32000,
          "colStruct": {
            "name": "native",
            "score": 42,
          },
          "colTime": 45296789000n,
          "colTimestamp": 2026-08-11T12:34:56.789Z,
          "colTimestampMs": 2026-08-11T12:34:56.789Z,
          "colTimestampNs": 2026-08-11T12:34:56.789Z,
          "colTimestampS": 2026-08-11T12:34:56.000Z,
          "colTimestamptz": 2026-08-11T12:34:56.789Z,
          "colTinyint": -8,
          "colUbigint": 18000000000000000000n,
          "colUhugeint": 123456789012345678901234567890n,
          "colUinteger": 4000000000,
          "colUsmallint": 65535,
          "colUtinyint": 255,
          "colVarchar": "DuckDB text",
        }
      `);
   });

   test("selects every native column through generated row metadata", async () => {
      const selected = await sql`
         select ${row(TypeCoverage.$$)} from ${TypeCoverage}
         where ${TypeCoverage.$colUuid} = ${inserted.colUuid}
      `.duckdb.one({ db });

      expect(selected.colUuid).toBe(inserted.colUuid);
      expect(selected.colBlob).toBeInstanceOf(Uint8Array);
      expect(selected.colDate).toBeInstanceOf(Date);
      expect(selected.colTimestampNs).toBeInstanceOf(Date);
      expect(selected.colList).toMatchInlineSnapshot(`
        [
          1,
          2,
          3,
        ]
      `);
      expect(selected.colStruct).toMatchInlineSnapshot(`
        {
          "name": "native",
          "score": 42,
        }
      `);
      expect(selected.colMap).toMatchInlineSnapshot(`
        [
          {
            "key": "one",
            "value": 1,
          },
          {
            "key": "two",
            "value": 2,
          },
        ]
      `);
   });
});
