import { describe, expect, test } from "vitest";
import { SqlQueryRegistry } from "#src/execution/sql-query-registry.js";
import { sql } from "#src/core/sql.js";
import { row } from "#src/core/query/sql-select-row.js";
import { ctx, param } from "#src/core/query/sql-param.js";
import { Account } from "@test-models/vexnor_dev.account-table.js";
import { MockPlugin, MockConnection } from "#src/test/mock-plugin.js";

const plugin = new MockPlugin({ name: "testPlugin" });

function makeDb(rows: unknown[] = []): MockConnection {
   return { query: async () => ({ rows }) } as MockConnection;
}

describe("SqlQueryRegistry — mergeRuntimeParams", () => {
   test("context params are injected from runtime context", async () => {
      const queryWithCtx = sql`
         select ${row(Account.$accountId, Account.$email)}
         from ${Account}
         where ${Account.$accountId} = ${ctx<{ userId: string }>("userId")}
      `;

      const registry = new SqlQueryRegistry<{ userId: string }>();
      await registry.register(plugin, { queryWithCtx });

      const hash = await queryWithCtx.hash;
      const result = await registry.execute(
         { plugin: "testPlugin", hash, params: {}, location: "test", mode: "read", name: null },
         async () => makeDb([{ accountId: "ctx-123", email: "ctx@test.com" }]),
         { userId: "ctx-123" },
      );

      expect(result).toMatchInlineSnapshot(`
        {
          "rows": [
            {
              "accountId": "ctx-123",
              "email": "ctx@test.com",
            },
          ],
        }
      `);
   });

   test("filterParams strips params not defined in query (strictParams: true)", async () => {
      const simpleQuery = sql`
         select ${row(Account.$accountId)}
         from ${Account}
         where ${Account.$email} = ${param<{ email: string }>("email")}
      `;

      const registry = new SqlQueryRegistry({ strictParams: true });
      await registry.register(plugin, { simpleQuery });

      const hash = await simpleQuery.hash;
      const result = await registry.execute(
         { plugin: "testPlugin", hash, params: { email: "test@test.com", extra: "ignored" }, location: "test", mode: "read", name: null },
         async () => makeDb([{ accountId: "1" }]),
      );

      expect(result).toMatchInlineSnapshot(`
        {
          "rows": [
            {
              "accountId": "1",
            },
          ],
        }
      `);
   });

   test("mergeRuntimeParams returns params unchanged when no context params exist", async () => {
      const queryNoCtx = sql`
         select ${row(Account.$accountId)}
         from ${Account}
         where ${Account.$email} = ${param<{ email: string }>("email")}
      `;

      const registry = new SqlQueryRegistry<{ userId: string }>();
      await registry.register(plugin, { queryNoCtx });

      const hash = await queryNoCtx.hash;
      const result = await registry.execute(
         { plugin: "testPlugin", hash, params: { email: "a@b.com" }, location: "test", mode: "read", name: null },
         async () => makeDb([{ accountId: "2" }]),
         { userId: "unused" },
      );

      expect(result).toMatchInlineSnapshot(`
        {
          "rows": [
            {
              "accountId": "2",
            },
          ],
        }
      `);
   });
});
