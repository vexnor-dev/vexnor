import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { param, row, sql } from "vexnor";
import { sqlite3Update } from "@vexnor/sqlite3";
import { ITypeCoverageSelect, TypeCoverage } from "./codegen/main.type_coverage-table.js";
import { db } from "./config.js";

describe("sqlite3 type coverage", () => {
   let inserted!: ITypeCoverageSelect;

   beforeAll(async () => {
      inserted = await sql`
         insert into ${TypeCoverage} ${TypeCoverage.insertColsVals({
            colText: "hello",
            colVarchar: "world",
            colChar: "char      ",
            colInteger: 1,
            colInt: 2,
            colTinyint: 3,
            colSmallint: 4,
            colBigint: 9007199254740991,
            colReal: 1.5,
            colFloat: 2.5,
            colDouble: 3.14159265358979,
            colNumeric: 123.45,
            colDecimal: 678.9,
            colBoolean: 1,
            colDate: "2024-01-15",
            colDatetime: "2024-01-15 10:30:00",
            colTimestamp: "2024-01-15 10:30:00",
            colBlob: new Uint8Array([1, 2, 3, 4]),
         })}
         returning ${row(TypeCoverage.$$)}
      `.sqlite.one({ db });
   });

   afterAll(async () => {
      await sql`delete from ${TypeCoverage}`.sqlite.run({ db });
   });

   test("insert and select back all types", () => {
      expect(inserted).toMatchInlineSnapshot(`
        {
          "colBigint": 9007199254740991,
          "colBlob": {
            "data": [
              1,
              2,
              3,
              4,
            ],
            "type": "Buffer",
          },
          "colBoolean": 1,
          "colChar": "char      ",
          "colDate": "2024-01-15",
          "colDatetime": "2024-01-15 10:30:00",
          "colDecimal": 678.9,
          "colDouble": 3.14159265358979,
          "colFloat": 2.5,
          "colInt": 2,
          "colInteger": 1,
          "colNumeric": 123.45,
          "colReal": 1.5,
          "colSmallint": 4,
          "colText": "hello",
          "colTimestamp": "2024-01-15 10:30:00",
          "colTinyint": 3,
          "colVarchar": "world",
        }
      `);
   });

   test("update and select back all types", async () => {
      const result = await sqlite3Update(TypeCoverage, {
         WHERE: sql`${TypeCoverage.$colText} = ${param<{ key: string }>("key")}`,
      }).one({
         db,
         params: {
            key: inserted.colText,
            set: {
               colVarchar: "updated",
               colChar: "upd       ",
               colInteger: 99,
               colInt: 88,
               colTinyint: 77,
               colSmallint: 66,
               colBigint: 55,
               colReal: 9.9,
               colFloat: 8.8,
               colDouble: 7.777777777777777,
               colNumeric: 999.99,
               colDecimal: 888.88,
               colBoolean: 0,
               colDate: "2025-06-01",
               colDatetime: "2025-06-01 08:00:00",
               colTimestamp: "2025-06-01 08:00:00",
               colBlob: new Uint8Array([5, 6, 7, 8]),
            },
         },
      });
      expect(result).toMatchInlineSnapshot(`
        {
          "colBigint": 55,
          "colBlob": {
            "data": [
              5,
              6,
              7,
              8,
            ],
            "type": "Buffer",
          },
          "colBoolean": 0,
          "colChar": "upd       ",
          "colDate": "2025-06-01",
          "colDatetime": "2025-06-01 08:00:00",
          "colDecimal": 888.88,
          "colDouble": 7.777777777777777,
          "colFloat": 8.8,
          "colInt": 88,
          "colInteger": 99,
          "colNumeric": 999.99,
          "colReal": 9.9,
          "colSmallint": 66,
          "colText": "hello",
          "colTimestamp": "2025-06-01 08:00:00",
          "colTinyint": 77,
          "colVarchar": "updated",
        }
      `);
   });
});
