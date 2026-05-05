import { SqlQueryHandler, SqlQuery, SqlRunArgs, SqlRunError } from "valnor";
import type { QueryResult } from "pg";
import { PostgresTokenizer } from "#/postgres-tokenizer.js";

export type PostgresClient = {
   query: (queryConfig: { text: string; values: unknown[] }) => Promise<QueryResult>;
};

type RowOrDefault<T> = T extends object ? T : never;

export class PostgresQueryHandler<T extends { Row?: unknown; Params?: unknown }> extends SqlQueryHandler<
   Pick<T, "Row" | "Params"> & {
      QueryResult: QueryResult<RowOrDefault<T["Row"]>>;
      Connection: PostgresClient;
   }
> {
   constructor(readonly query: SqlQuery<Pick<T, "Row" | "Params">>) {
      super(query);
   }

   getOptions(args: SqlRunArgs<{ Connection: PostgresClient; Params: T["Params"] }>) {
      let queryInput = undefined;
      try {
         const newArgs = {
            ...args,
            options: {
               ...args.options,
               tokenizer: new PostgresTokenizer(this.query.id),
               dialect: "postgresql",
               paramFormat: (args: { index: number }) => `$${args.index + 1}`,
            },
         };

         queryInput = this.query.getSql(newArgs);
         return queryInput;
      } catch (err) {
         throw new SqlRunError(`Error building postgres query '${this.query.id}'`, this.query, { cause: err });
      }
   }

   resolveRows(result: QueryResult<RowOrDefault<T["Row"]>>): T["Row"][] {
      return result.rows;
   }

   /**
    * Executes the query and returns the raw `pg` `QueryResult`.
    *
    * You typically don't call this directly — use `getAll()`, `getOneRequired()`,
    * or `getOneOptional()` instead. Call `run()` when you need access to the full
    * `QueryResult` object (e.g. `rowCount`, `fields`).
    *
    * @param args - Database connection and query parameters.
    */
   async run(
      args: SqlRunArgs<{ Connection: PostgresClient; Params: T["Params"] }>,
   ): Promise<QueryResult<RowOrDefault<T["Row"]>>> {
      const { db, options: { debug } = {} } = args;
      let queryInput = undefined;
      try {
         queryInput = this.getOptions(args);
         if (debug) debug(Object.freeze(queryInput));
         const { text, values } = queryInput;
         return await (await db).query({ text, values });
      } catch (err) {
         throw new SqlRunError(`Error running postgres query '${this.query.id}'`, this.query, { cause: err }, queryInput?.text);
      }
   }
}
