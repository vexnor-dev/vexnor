import { SqlRunArgs } from "../sql-types.js";
import { SqlQuery } from "./sql-query.js";
import { SqlQueryHandler } from "./sql-query-handler.js";
import { ok } from "assert";

/**
 * Default SqlQueryHandler
 */
export abstract class AsyncQueryHandler<
   T extends { Row?: unknown; Params?: unknown; QueryResult: object; QueryClient: unknown },
> extends SqlQueryHandler<T> {
   protected constructor(readonly query: SqlQuery<{ Row?: T["Row"]; Params?: T["Params"] }>) {
      super(query);
   }

   abstract resolveRows(res: T["QueryResult"]): T["Row"][];

   abstract run(args: SqlRunArgs<T["QueryClient"], T["Params"]>): Promise<T["QueryResult"]>;

   /**
    * Executes the core and returns exactly one row, or throw error when result not found or more
    * @param args
    */
   async getOneRequired(args: SqlRunArgs<T["QueryClient"], T["Params"]>): Promise<T["Row"]> {
      const rows = await this.getAll(args);
      ok(rows.length === 1, `Expected one row, actual is ${rows.length} rows.`);
      ok(rows[0], `The one row in result is not defined: ${rows[0]}`);
      return rows[0];
   }

   /**
    * Executes the core and returns the first row, or undefined when no rows found
    * @param args
    */
   async getOneOptional(args: SqlRunArgs<T["QueryClient"], T["Params"]>): Promise<T["Row"] | undefined> {
      const rows = await this.getAll(args);
      return rows.length > 0 ? rows[0] : undefined;
   }

   /**
    * Executes the core and returns all rows
    * @param args
    */
   async getAll(args: SqlRunArgs<T["QueryClient"], T["Params"]>): Promise<T["Row"][]> {
      return await this.run(args).then((res) => this.resolveRows(res));
   }
}
