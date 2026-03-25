import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { param } from "valnor";
import { mssqlCrud, sql } from "valnor-mssql";
import { ITypeCoverageSelect, TypeCoverage } from "./codegen/valnor_test.type_coverage-table.js";
import { pool } from "./mssql-pool.js";

describe("mssql type coverage", () => {
   const TypeCoverageCrud = mssqlCrud(TypeCoverage);
   let inserted!: ITypeCoverageSelect;

   beforeAll(async () => {
      inserted = await TypeCoverageCrud.insertRows!().getOneRequired({
         db: pool.request(),
         params: {
            rows: [{
               colVarchar: "hello",
               colNvarchar: "world",
               colChar: "char      ",
               colNchar: "nchar     ",
               colText: "text value",
               colNtext: "ntext value",
               colXml: "<root><child/></root>",
               colTime: new Date("1970-01-01T13:45:00Z"),
               colInt: 2147483647,
               colSmallint: 32767,
               colTinyint: 255,
               colDecimal: 12345.67,
               colNumeric: 98765.43,
               colFloat: 3.141592653589793,
               colReal: 3.14,
               colMoney: 1234.56,
               colSmallmoney: 123.45,
               colBigint: "9223372036854775807",
               colBit: true,
               colDate: new Date("2024-01-15"),
               colDatetime: new Date("2024-01-15T10:30:00Z"),
               colDatetime2: new Date("2024-01-15T10:30:00Z"),
               colSmalldatetime: new Date("2024-01-15T10:30:00Z"),
               colBinary: new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]),
               colVarbinary: new Uint8Array([1, 2, 3, 4]),
               colImage: new Uint8Array([255, 0, 128]),
            }],
         },
      });
   });

   afterAll(async () => {
      await sql`delete from ${TypeCoverage}`.mssql.run({ db: pool.request() });
   });

   test("insert and select back all types", () => {
      const { colUniqueidentifier, colDatetimeoffset, ...result } = inserted;
      expect(typeof colUniqueidentifier).toMatchInlineSnapshot(`"string"`);
      expect(colDatetimeoffset).toBeInstanceOf(Date);
      expect(result).toMatchInlineSnapshot(`
        {
          "colBigint": "9223372036854775807",
          "colBinary": {
            "data": [
              1,
              2,
              3,
              4,
              5,
              6,
              7,
              8,
              9,
              10,
            ],
            "type": "Buffer",
          },
          "colBit": true,
          "colChar": "char      ",
          "colDate": 2024-01-15T00:00:00.000Z,
          "colDatetime": 2024-01-15T10:30:00.000Z,
          "colDatetime2": 2024-01-15T10:30:00.000Z,
          "colDecimal": 12345.67,
          "colFloat": 3.141592653589793,
          "colImage": {
            "data": [
              255,
              0,
              128,
            ],
            "type": "Buffer",
          },
          "colInt": 2147483647,
          "colMoney": 1234.56,
          "colNchar": "nchar     ",
          "colNtext": "ntext value",
          "colNumeric": 98765.43,
          "colNvarchar": "world",
          "colReal": 3.140000104904175,
          "colSmalldatetime": 2024-01-15T10:30:00.000Z,
          "colSmallint": 32767,
          "colSmallmoney": 123.45,
          "colText": "text value",
          "colTime": 1970-01-01T13:45:00.000Z,
          "colTinyint": 255,
          "colVarbinary": {
            "data": [
              1,
              2,
              3,
              4,
            ],
            "type": "Buffer",
          },
          "colVarchar": "hello",
          "colXml": "<root><child/></root>",
        }
      `);
   });

   test("update and select back all types", async () => {
      const idParam = param<{ id: string }>("id");
      const updated = await TypeCoverageCrud.update!({
         WHERE: sql`${TypeCoverage.$colUniqueidentifier} = ${idParam}`,
      }).getOneRequired({
         db: pool.request(),
         params: {
            id: inserted.colUniqueidentifier,
            set: {
               colVarchar: "updated",
               colNvarchar: "updated world",
               colChar: "upd       ",
               colNchar: "upd       ",
               colText: "updated text",
               colNtext: "updated ntext",
               colXml: "<updated/>",
               colTime: new Date("1970-01-01T14:00:00Z"),
               colInt: 42,
               colSmallint: 100,
               colTinyint: 10,
               colDecimal: 99.99,
               colNumeric: 11.11,
               colFloat: 2.718281828459045,
               colReal: 2.72,
               colMoney: 99.99,
               colSmallmoney: 9.99,
               colBigint: "9223372036854775806",
               colBit: false,
               colDate: new Date("2025-06-01"),
               colDatetime: new Date("2025-06-01T08:00:00Z"),
               colDatetime2: new Date("2025-06-01T08:00:00Z"),
               colSmalldatetime: new Date("2025-06-01T08:00:00Z"),
               colDatetimeoffset: new Date("2025-06-01T08:00:00Z"),
               colBinary: new Uint8Array([10, 20, 30, 40, 50, 60, 70, 80, 90, 100]),
               colVarbinary: new Uint8Array([9, 10, 11, 12]),
               colImage: new Uint8Array([0, 128, 255]),
            },
         },
      });
      expect(updated.colDatetimeoffset).toBeInstanceOf(Date);
      const { colDatetimeoffset, colUniqueidentifier, ...result } = updated;
      expect(result).toMatchInlineSnapshot(`
        {
          "colBigint": "9223372036854775806",
          "colBinary": {
            "data": [
              10,
              20,
              30,
              40,
              50,
              60,
              70,
              80,
              90,
              100,
            ],
            "type": "Buffer",
          },
          "colBit": false,
          "colChar": "upd       ",
          "colDate": 2025-06-01T00:00:00.000Z,
          "colDatetime": 2025-06-01T08:00:00.000Z,
          "colDatetime2": 2025-06-01T08:00:00.000Z,
          "colDecimal": 99.99,
          "colFloat": 2.718281828459045,
          "colImage": {
            "data": [
              0,
              128,
              255,
            ],
            "type": "Buffer",
          },
          "colInt": 42,
          "colMoney": 99.99,
          "colNchar": "upd       ",
          "colNtext": "updated ntext",
          "colNumeric": 11.11,
          "colNvarchar": "updated world",
          "colReal": 2.7200000286102295,
          "colSmalldatetime": 2025-06-01T08:00:00.000Z,
          "colSmallint": 100,
          "colSmallmoney": 9.99,
          "colText": "updated text",
          "colTime": 1970-01-01T14:00:00.000Z,
          "colTinyint": 10,
          "colVarbinary": {
            "data": [
              9,
              10,
              11,
              12,
            ],
            "type": "Buffer",
          },
          "colVarchar": "updated",
          "colXml": "<updated/>",
        }
      `);
   });
});
