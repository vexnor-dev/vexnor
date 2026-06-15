import { describe, expect, test } from "vitest";
import { SqlSelectCharm } from "@vexnor/core";
import type { IResult } from "mssql";
import { sql } from "#/mssql-sql.js";

describe("MssqlQueryHandler.deserialize", () => {
   test("deserializes both recordset and recordsets consistently", () => {
      const query = sql`
         select ${new SqlSelectCharm({
            key: "lastOrder",
            params: null,
            jsonSchema: { lastOrder: { createdAt: "Date" } },
            write(context) {
               context.addStrings(`null as "lastOrder"`);
            },
         })}
      `;

      const lastOrderJson = JSON.stringify({
         orderId: "order-1",
         createdAt: "2026-05-31T19:59:35.512Z",
      });

      const result = {
         recordset: [{ lastOrder: lastOrderJson }],
         recordsets: [[{ lastOrder: lastOrderJson }]],
         rowsAffected: [1],
         output: {},
      } as unknown as IResult<{ lastOrder: { createdAt: Date; orderId: string } | null }>;

      const parsed = query.deserialize(result, true);

      expect(parsed.recordset[0]?.lastOrder).toMatchObject({
         orderId: "order-1",
      });
      expect((parsed.recordset[0]?.lastOrder as { createdAt?: unknown } | null)?.createdAt).toBeInstanceOf(Date);
      expect(parsed.recordsets[0]?.[0]?.lastOrder).toMatchObject({
         orderId: "order-1",
      });
      expect((parsed.recordsets[0]?.[0]?.lastOrder as { createdAt?: unknown } | null)?.createdAt).toBeInstanceOf(Date);
   });

   test("rehydrates recordset from recordsets[0] when recordset is missing", () => {
      const query = sql`
         select ${new SqlSelectCharm({
            key: "lastOrder",
            params: null,
            jsonSchema: { lastOrder: { createdAt: "Date" } },
            write(context) {
               context.addStrings(`null as "lastOrder"`);
            },
         })}
      `;

      const lastOrderJson = JSON.stringify({
         orderId: "order-1",
         createdAt: "2026-05-31T19:59:35.512Z",
      });

      const compactResult = {
         recordsets: [[{ lastOrder: lastOrderJson }]],
         rowsAffected: [1],
         output: {},
      } as unknown as IResult<{ lastOrder: { createdAt: Date; orderId: string } | null }>;

      const parsed = query.deserialize(compactResult, true);

      expect(parsed.recordset[0]?.lastOrder).toMatchObject({
         orderId: "order-1",
      });
      expect((parsed.recordset[0]?.lastOrder as { createdAt?: unknown } | null)?.createdAt).toBeInstanceOf(Date);
      expect(parsed.recordsets[0]?.[0]?.lastOrder).toMatchObject({
         orderId: "order-1",
      });
   });
});
