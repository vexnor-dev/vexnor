import { MockConnection, MockResult } from "#/test/mock-plugin.js";
import { SqlQueryHandler } from "#/core/query/sql-query-handler.js";
import { SqlQuery } from "#/core/query/sql-query.js";
import { SqlRunArgs } from "#/core/query/sql-query-types.js";
import { ok } from "#/lib/assert.js";

export class MockQueryHandler<T extends { Row?: unknown; Params?: unknown }> extends SqlQueryHandler<
   Pick<T, "Row" | "Params"> & {
      Read: MockResult<T["Row"]>;
      Write: MockResult<T["Row"]>;
      Connection: MockConnection;
   }
> {
   constructor(q: SqlQuery<T>) {
      super(q, { pluginName: "mock" });
   }

   resolveRows(result: MockResult<T["Row"]>): T["Row"][] {
      ok(result?.rows, "Expected rows in result");
      return result.rows as T["Row"][];
   }

   deserialize(result: MockResult<T["Row"]>, remote: boolean): MockResult<T["Row"]> {
      return { ...result, rows: this.deserializeRows(result.rows as T["Row"][], remote) };
   }

   async execute(args: SqlRunArgs<{ Connection: MockConnection; Params: T["Params"] }>) {
      const db = await args.db;
      const { text, values } = this.source.getSql(args);
      return await db.query(text, values);
   }
}

export function mockHandler<T extends { Row?: unknown; Params?: unknown }>(query: SqlQuery<T>): MockQueryHandler<T> {
   return new MockQueryHandler<T>(query);
}
