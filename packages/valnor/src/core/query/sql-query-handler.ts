import { SqlQuery, SqlQueryExtended } from "#/core/query/sql-query.js";
import { ok } from "assert";
import { SqlRunArgs } from "#/core/query/sql-query-types.js";
import { SqlRunError } from "#/core/sql-run-error.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SqlQueryHandlerAny = SqlQueryHandler<any>;

/**
 * Base query handler for async database operations
 */
export abstract class SqlQueryHandler<
   T extends { Row?: unknown; Params?: unknown; QueryResult: object; Connection: unknown },
> extends SqlQuery<Pick<T, "Params" | "Row">> {
   protected constructor(query: SqlQuery<Pick<T, "Row" | "Params">>) {
      super(query);
   }

   abstract resolveRows(res: T["QueryResult"]): T["Row"][];

   abstract run(args: SqlRunArgs<Pick<T, "Connection" | "Params">>): Promise<T["QueryResult"]>;

   /**
    * Executes the core and returns exactly one row, or throw error when result not found or more
    * @param args
    */
   async getOneRequired(args: SqlRunArgs<Pick<T, "Connection" | "Params">>): Promise<T["Row"]> {
      const rows = await this.getAll(args);
      ok(rows.length === 1, `Expected one row, actual is ${rows.length} rows.`);
      ok(rows[0], `The one row in result is not defined: ${rows[0]}`);
      return rows[0];
   }

   /**
    * Executes the core and returns the first row, or undefined when no rows found
    * @param args
    */
   async getOneOptional(args: SqlRunArgs<Pick<T, "Connection" | "Params">>): Promise<T["Row"] | undefined> {
      const rows = await this.getAll(args);
      return rows.length > 0 ? rows[0] : undefined;
   }

   /**
    * Executes the core and returns all rows
    * @param args
    */
   async getAll(args: SqlRunArgs<Pick<T, "Connection" | "Params">>): Promise<T["Row"][]> {
      try {
         return await this.run(args).then((res) => this.resolveRows(res));
      } catch (err) {
         throw new SqlRunError(`Error executing MSSQL query '${this.id}'`, this, { cause: err });
      }
   }
}

export function newSqlQueryHandler<
   T extends { Row?: unknown; Params?: unknown; QueryResult: object; Connection: unknown },
   Handler extends SqlQueryHandler<T>,
>(handler: Handler): Handler & SqlQueryExtended<Pick<T, "Row" | "Params">> {
   return new Proxy(handler, {
      ownKeys(target): ArrayLike<string | symbol> {
         const rowKeys = target.row ? Object.keys(target.row) : [];
         return [...Reflect.ownKeys(target), ...rowKeys];
      },
      getOwnPropertyDescriptor(target, p: string | symbol): PropertyDescriptor | undefined {
         if (Reflect.has(target, p)) return Reflect.getOwnPropertyDescriptor(target, p);
         if (target.row && Reflect.has(target.row, p)) return Reflect.getOwnPropertyDescriptor(target.row, p);

         return undefined;
      },
      has(target, p: string | symbol): boolean {
         if (Reflect.has(target, p)) return true;
         return Boolean(target.row && Reflect.has(target.row, p));
      },
      get(target, p: string | symbol, receiver: unknown): unknown {
         if (Reflect.has(target, p)) return Reflect.get(target, p, receiver);
         if (target.row && Reflect.has(target.row, p)) return Reflect.get(target.row, p, receiver);

         return undefined;
      },
   });
}
