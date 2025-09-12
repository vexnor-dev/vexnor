import { QueryResult } from "pg";
import { isSqlRunOptions, RowOut, SqlBuild, SqlRunArgs, SqlValuesArgs } from "./sql-types.js";
import { SqlQueryRow } from "./sql-query-row.js";
import { SqlColumn } from "./sql-column.js";
import { x } from "./x.js";
import { generateRandomName } from "./types.js";
import { ok } from "assert";
import { SqlParam } from "./sql-param.js";
import { SqlQueryContext } from "./sql-query-context.js";
import { logger } from "../cli/logger.js";
import { Sql } from "./sql-base.js";
import { SqlClient } from "./sql-client.js";
import { SqlInfo } from "./plugins/index.js";
import * as crypto from "node:crypto";

const WILDCARD = "?";

export class SqlQuery<
   TRow extends RowOut = RowOut,
   TParams extends Record<string, unknown> | undefined = undefined,
> extends Sql {
   readonly name: string;
   readonly ID: string;
   private __buildCache__?: SqlBuild;
   private __row__?: SqlQueryRow & Record<keyof TRow, SqlColumn>;
   private debug: string[] = [];

   constructor(
      public readonly rawStrings: readonly string[],
      public readonly rawValues: readonly unknown[],
   ) {
      super();
      this.rawStrings = rawStrings;
      this.rawValues = rawValues;
      this.name = x(() => {
         const info = rawValues.find((v) => v instanceof SqlInfo);
         if (info) return info.options.label;

         return "query_" + generateRandomName();
      });
      this.ID = crypto.randomUUID();
   }

   get ROW(): SqlQueryRow & Record<keyof TRow, SqlColumn> {
      if (this.__row__) return this.__row__;

      this.__row__ = new Proxy<SqlQueryRow>(
         new SqlQueryRow({ name: this.name }),
         SqlQueryRow.proxyHandler,
      ) as SqlQueryRow & Record<keyof TRow, SqlColumn>;
      return this.__row__;
   }

   values(...[params]: SqlValuesArgs<TParams>): unknown[] {
      const { values } = this.buildCache();
      if (!values) return [];
      if (!params) return values ?? [];
      const results: unknown[] = [];
      for (let i = 0; i < values.length; i++) {
         const param = values[i];
         ok(param, `Param not found at position: ${i}`);
         if (!(param instanceof SqlParam)) {
            results.push(param);
            continue;
         }

         const value = params[param.name];
         if (Array.isArray(value)) results.push(...value);
         else results.push(value);
      }

      return results;
   }

   sql(...[params]: SqlValuesArgs<TParams>): string {
      const { values } = this.buildCache();
      const strings = [...this.buildCache().strings];
      if (!values?.length) return strings.join("");
      if (!params) return strings.join("");

      for (let i = 0, str = strings[0]; i < strings.length; i++, str = strings[i]) {
         ok(str, `Token not found at position: ${i}`);
         if (str === WILDCARD) continue;
         if (!str.startsWith(SqlParam.PREFIX)) continue;

         const param = values.find((p) => p instanceof SqlParam && p.wildcard === str);
         ok(param instanceof SqlParam, `Param not found for token: ${str}`);
         const value = params[param.name];
         if (Array.isArray(value)) {
            strings[i] = Array(value.length).fill(WILDCARD).join(", ");
         } else {
            strings[i] = WILDCARD;
         }
      }

      return strings.join("");
   }

   text(...args: SqlValuesArgs<TParams>): string {
      const sql = this.sql(...args);
      const tokens = sql.split(WILDCARD);
      for (let i = 0; i < tokens.length - 1; i++) {
         tokens[i] = tokens[i] + `$${i + 1}`;
      }

      return tokens.join("");
   }

   buildCache() {
      if (this.__buildCache__) return this.__buildCache__;

      const context = new SqlQueryContext({ queryName: this.name });
      try {
         this.build(context);
         this.__buildCache__ = {
            strings: context.strings,
            values: context.values,
         };
         return this.__buildCache__;
      } catch (err) {
         logger.error({ err, context, rawStrings: this.rawStrings }, "Error building query");
         throw err;
      }
   }

   toString() {
      return this.rawStrings.join("?");
   }

   /**
    * Executes the query and returns the result
    * @param args
    */
   async run<TDbClient extends SqlClient>(...args: SqlRunArgs<TDbClient, TParams>): Promise<QueryResult<TRow>> {
      const [opts, params] = args;
      const { db, config: { debug } = {} } = isSqlRunOptions(opts) ? opts : { db: opts };
      const _args_: SqlValuesArgs<TParams> = [params] as SqlValuesArgs<TParams>;
      let queryConfig = undefined;
      try {
         queryConfig = {
            text: this.text(..._args_),
            values: this.values(..._args_),
         };
         return await db.query<TRow>(queryConfig);
      } catch (err) {
         console.error(err, "\n", queryConfig?.text ?? "error building query");
         throw err;
      }
   }

   /**
    * Executes the query and returns exactly one row, or throw error when result not found or more
    * @param args
    */
   async getOneRequired<TClient extends SqlClient>(...args: SqlRunArgs<TClient, TParams>): Promise<TRow> {
      const rows = await this.run(...args).then((res) => res.rows);
      ok(rows.length === 1, `Expected one row, actual is ${rows.length} rows.`);
      ok(rows[0], `The one row in result is not defined: ${rows[0]}`);
      return rows[0];
   }

   /**
    * Executes the query and returns the first row, or undefined when no rows found
    * @param args
    */
   async getOneOptional<TClient extends SqlClient>(...args: SqlRunArgs<TClient, TParams>): Promise<TRow | undefined> {
      return this.run(...args).then((res) => (res.rows.length > 0 ? res.rows[0] : undefined));
   }

   /**
    * Executes the query and returns all rows
    * @param args
    */
   async getAll<TClient extends SqlClient>(...args: SqlRunArgs<TClient, TParams>): Promise<TRow[]> {
      return this.run(...args).then((res) => res.rows);
   }

   /**
    * Build the query using the context
    * @param context
    */
   build(context: SqlQueryContext) {
      context.queryLevel++;
      context.queryName = this.name;

      const wrapStart = () => {
         if (this.wrap) context.strings.push("(");
      };

      const wrapEnd = () => {
         if (this.wrap) context.strings.push(")");
      };

      switch (context.keyword) {
         case "select":
            wrapStart();
            this.internalBuild(context);
            wrapEnd();
            context.strings.push(` as "${this.name}"`);
            break;
         case "join":
            wrapStart();
            this.internalBuild(context);
            wrapEnd();
            context.strings.push(` as "${this.name}"`);
            break;
         case "from":
            wrapStart();
            this.internalBuild(context);
            wrapEnd();
            context.strings.push(` as "${this.name}"`);
            break;
         case "fn":
            context.strings.push(`"${this.name}"`);
            break;
         default:
            this.internalBuild(context);
            break;
      }
   }

   private internalBuild(context: SqlQueryContext) {
      const children = [...this.rawValues];
      const { strings, values } = context;
      let i = -1;
      while (children.length || i < this.rawStrings.length) {
         i++;
         const rawString = i < this.rawStrings.length ? this.rawStrings[i] : undefined;
         if (rawString) {
            strings.push(rawString);
            context.next(rawString);
         }

         if (!children.length) break;

         const child = children.shift();

         function buildToken(item: unknown, delimiter = "") {
            const addString = (text: string) => `${text}${delimiter}`;
            switch (true) {
               case item instanceof Sql:
                  item.build(context, { onAddString: addString });
                  break;
               case !item:
                  values.push(item);
                  strings.push(addString(WILDCARD));
                  break;
               default:
                  values.push(item);
                  strings.push(addString(WILDCARD));
                  break;
            }
         }

         try {
            if (Array.isArray(child)) {
               for (let k = 0; k < child.length; k++) {
                  if (k > 0) {
                     strings.push(", ");
                  }

                  buildToken(child[k]);
               }
            } else {
               buildToken(child);
            }
         } catch (err) {
            logger.error(
               { err, context: context, rawString, child: child instanceof Sql ? child : "xxx" },
               "Query context",
            );
            throw err;
         }
      }
   }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SqlQueryAny = SqlQuery<any, any>;
