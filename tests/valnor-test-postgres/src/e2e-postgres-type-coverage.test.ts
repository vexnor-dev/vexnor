import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { param, row, sql } from "valnor";
import "valnor-postgres";
import { ITypeCoverageSelect, TypeCoverage } from "./codegen/valnor_test.type_coverage-table.js";
import { pool } from "./postgres-pool.js";

describe("postgres type coverage", () => {
   let inserted!: ITypeCoverageSelect;

   beforeAll(async () => {
      inserted = await sql`
         insert into ${TypeCoverage} ${TypeCoverage.insertColsVals({
            colText: "hello",
            colVarchar: "world",
            colBpchar: "char      ",
            colJson: JSON.stringify({ key: "value" }) as unknown,
            colJsonb: JSON.stringify({ nested: { num: 1 } }) as unknown,
            colXml: "<root><child/></root>",
            colInet: "192.168.1.1",
            colCidr: "192.168.1.0/24",
            colMacaddr: "08:00:2b:01:02:03",
            colBit: "10101010",
            colVarbit: "1010",
            colInterval: "1 year 2 months",
            colTime: "13:45:00",
            colTimetz: "13:45:00+01",
            colMoney: "$1,234.56",
            colInt2: 32767,
            colInt4: 2147483647,
            colFloat4: 3.14,
            colFloat8: 3.141592653589793,
            colInt8: "9223372036854775807",
            colNumeric: "12345.67",
            colBool: true,
            colDate: new Date("2024-01-15"),
            colTimestamp: new Date("2024-01-15T10:30:00Z"),
            colBytea: new Uint8Array([1, 2, 3, 4]),
            colOid: 12345,
            colXid: "123",
            colName: "pg_catalog",
            colPgLsn: "0/1234567",
            colTsvector: "'hello' 'world'",
            colTsquery: "'hello' & 'world'",
            colPoint: "(1.5,2.5)",
            colLine: "{1,2,3}",
            colLseg: "[(0,0),(1,1)]",
            colBox: "(1,1),(0,0)",
            colPath: "[(0,0),(1,1),(2,0)]",
            colPolygon: "((0,0),(1,1),(2,0))",
            colCircle: "<(1,1),5>",
         })}
         returning ${row(TypeCoverage.$$)}
      `.postgres.one({ db: pool });
   });

   afterAll(async () => {
      await sql`delete from ${TypeCoverage}`.postgres.run({ db: pool });
   });

   test("insert and select back all types", () => {
      const { colUuid, colTimestamptz, colDate, ...result } = inserted;
      expect(typeof colUuid).toMatchInlineSnapshot(`"string"`);
      expect(colTimestamptz).toBeInstanceOf(Date);
      expect(colDate.getFullYear()).toBe(2024);
      expect(colDate.getMonth()).toBe(0);
      expect(colDate.getDate()).toBe(15);
      expect(result).toMatchInlineSnapshot(`
        {
          "colBit": "10101010",
          "colBool": true,
          "colBox": "(1,1),(0,0)",
          "colBpchar": "char      ",
          "colBytea": {
            "data": [
              1,
              2,
              3,
              4,
            ],
            "type": "Buffer",
          },
          "colCidr": "192.168.1.0/24",
          "colCircle": {
            "radius": 5,
            "x": 1,
            "y": 1,
          },
          "colFloat4": 3.14,
          "colFloat8": 3.141592653589793,
          "colInet": "192.168.1.1",
          "colInt2": 32767,
          "colInt4": 2147483647,
          "colInt8": "9223372036854775807",
          "colInterval": PostgresInterval {
            "months": 2,
            "years": 1,
          },
          "colJson": {
            "key": "value",
          },
          "colJsonb": {
            "nested": {
              "num": 1,
            },
          },
          "colLine": "{1,2,3}",
          "colLseg": "[(0,0),(1,1)]",
          "colMacaddr": "08:00:2b:01:02:03",
          "colMoney": "$1,234.56",
          "colName": "pg_catalog",
          "colNumeric": "12345.67",
          "colOid": 12345,
          "colPath": "[(0,0),(1,1),(2,0)]",
          "colPgLsn": "0/1234567",
          "colPoint": {
            "x": 1.5,
            "y": 2.5,
          },
          "colPolygon": "((0,0),(1,1),(2,0))",
          "colText": "hello",
          "colTime": "13:45:00",
          "colTimestamp": 2024-01-15T10:30:00.000Z,
          "colTimetz": "13:45:00+01",
          "colTsquery": "'hello' & 'world'",
          "colTsvector": "'hello' 'world'",
          "colVarbit": "1010",
          "colVarchar": "world",
          "colXid": "123",
          "colXml": "<root><child/></root>",
        }
      `);
   });

   test("update and select back all types", async () => {
      const idParam = param<{ id: string }>("id");
      const updated = await TypeCoverage.postgres
         .update({
            WHERE: sql`${TypeCoverage.$colUuid} = ${idParam}`,
         })
         .one({
            db: pool,
            params: {
               id: inserted.colUuid,
               set: {
                  colText: "updated text",
                  colVarchar: "updated world",
                  colBpchar: "upd       ",
                  colJson: JSON.stringify({ key: "updated" }) as unknown,
                  colJsonb: JSON.stringify({ nested: { num: 2 } }) as unknown,
                  colXml: "<updated/>",
                  colInet: "10.0.0.1",
                  colCidr: "10.0.0.0/8",
                  colMacaddr: "ff:ff:ff:ff:ff:ff",
                  colBit: "11111111",
                  colVarbit: "1111",
                  colInterval: "2 years 3 months",
                  colTime: "14:00:00",
                  colTimetz: "14:00:00+02",
                  colMoney: "$9,999.99",
                  colInt2: 100,
                  colInt4: 42,
                  colFloat4: 2.72,
                  colFloat8: 2.718281828459045,
                  colInt8: "9223372036854775806",
                  colNumeric: "99999.99",
                  colBool: false,
            colDate: new Date("2025-06-01"),
                  colTimestamp: new Date("2025-06-01T08:00:00Z"),
                  colTimestamptz: new Date("2025-06-01T08:00:00Z"),
                  colBytea: new Uint8Array([5, 6, 7, 8]),
                  colOid: 99999,
                  colXid: "456",
                  colName: "public",
                  colPgLsn: "0/7654321",
                  colTsvector: "'updated' 'text'",
                  colTsquery: "'updated' & 'text'",
                  colPoint: "(3.0,4.0)",
                  colLine: "{3,4,5}",
                  colLseg: "[(1,1),(2,2)]",
                  colBox: "(2,2),(1,1)",
                  colPath: "[(1,1),(2,2),(3,1)]",
                  colPolygon: "((1,1),(2,2),(3,1))",
                  colCircle: "<(2,2),10>",
               },
            },
         });
      expect(updated.colTimestamptz).toBeInstanceOf(Date);
      const { colTimestamptz, colUuid, colDate, ...result } = updated;
      expect(colDate.getFullYear()).toBe(2025);
      expect(colDate.getMonth()).toBe(5);
      expect(colDate.getDate()).toBe(1);
      expect(result).toMatchInlineSnapshot(`
        {
          "colBit": "11111111",
          "colBool": false,
          "colBox": "(2,2),(1,1)",
          "colBpchar": "upd       ",
          "colBytea": {
            "data": [
              5,
              6,
              7,
              8,
            ],
            "type": "Buffer",
          },
          "colCidr": "10.0.0.0/8",
          "colCircle": {
            "radius": 10,
            "x": 2,
            "y": 2,
          },
          "colFloat4": 2.72,
          "colFloat8": 2.718281828459045,
          "colInet": "10.0.0.1",
          "colInt2": 100,
          "colInt4": 42,
          "colInt8": "9223372036854775806",
          "colInterval": PostgresInterval {
            "months": 3,
            "years": 2,
          },
          "colJson": {
            "key": "updated",
          },
          "colJsonb": {
            "nested": {
              "num": 2,
            },
          },
          "colLine": "{3,4,5}",
          "colLseg": "[(1,1),(2,2)]",
          "colMacaddr": "ff:ff:ff:ff:ff:ff",
          "colMoney": "$9,999.99",
          "colName": "public",
          "colNumeric": "99999.99",
          "colOid": 99999,
          "colPath": "[(1,1),(2,2),(3,1)]",
          "colPgLsn": "0/7654321",
          "colPoint": {
            "x": 3,
            "y": 4,
          },
          "colPolygon": "((1,1),(2,2),(3,1))",
          "colText": "updated text",
          "colTime": "14:00:00",
          "colTimestamp": 2025-06-01T08:00:00.000Z,
          "colTimetz": "14:00:00+02",
          "colTsquery": "'updated' & 'text'",
          "colTsvector": "'text' 'updated'",
          "colVarbit": "1111",
          "colVarchar": "updated world",
          "colXid": "456",
          "colXml": "<updated/>",
        }
      `);
   });
});
