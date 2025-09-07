import { QueryResult } from "pg";
import { RowOut, SqlBuild, SqlRunArgs, SqlValuesArgs } from "./sql-types.js";
import { SqlQueryRow } from "./sql-query-row.js";
import { SqlColumn } from "./sql-column.js";
import { x } from "./x.js";
import { SqlTable } from "./sql-table.js";
import { generateRandomName } from "./types.js";
import { ok } from "assert";
import { SqlParam } from "./sql-param.js";
import { SqlQueryContext } from "./sql-query-context.js";
import { logger } from "../cli/logger.js";
import { Sql } from "./sql-base.js";
import { SqlClient } from "./sql-client.js";

const WILDCARD = "?";

export class SqlQuery<
   TRow extends RowOut = RowOut,
   TParams extends Record<string, unknown> | undefined = undefined,
> extends Sql {
   /**
    * SqlColumn for selecting "*" - all columns of current TRow
    */
   readonly $all: SqlColumn;

   /**
    * name of the query.
    * this gets auto-generated, and can be set
    */
   name: string;

   private __queryBuild__?: SqlBuild;
   private __row__?: SqlQueryRow & Record<keyof TRow, SqlColumn>;

   constructor(
      public readonly rawStrings: readonly string[],
      public readonly rawValues: readonly unknown[],
   ) {
      super();
      this.rawStrings = rawStrings;
      this.rawValues = rawValues;
      this.name =
         x(() => {
            const table = rawValues.find((v) => v instanceof SqlTable);
            if (table) return table.$alias ?? table.$name;

            const col = rawValues.find((v) => v instanceof SqlColumn);
            if (col) return col.table;

            return generateRandomName();
         }) + "_query";
      this.$all = new SqlColumn({
         name: "*",
         table: this.name,
      });
   }

   get ROW(): SqlQueryRow & Record<keyof TRow, SqlColumn> {
      if (this.__row__) return this.__row__;

      this.__row__ = new Proxy<SqlQueryRow>(
         new SqlQueryRow({ name: this.name }),
         SqlQueryRow.proxyHandler,
      ) as SqlQueryRow & Record<keyof TRow, SqlColumn>;
      return this.__row__;
   }

   getValues(...[params]: SqlValuesArgs<TParams>): unknown[] {
      const { values } = this.getBuild();
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

   getSql(...[params]: SqlValuesArgs<TParams>): string {
      const { values } = this.getBuild();
      const strings = [...this.getBuild().strings];
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

   getText(...args: SqlValuesArgs<TParams>): string {
      const sql = this.getSql(...args);
      const tokens = sql.split(WILDCARD);
      for (let i = 0; i < tokens.length - 1; i++) {
         tokens[i] = tokens[i] + `$${i + 1}`;
      }

      return tokens.join("");
   }

   getBuild() {
      if (this.__queryBuild__) return this.__queryBuild__;

      const context = new SqlQueryContext({ mode: "root" });
      try {
         const { values, strings } = this.build(context);
         this.__queryBuild__ = {
            strings,
            values: values ?? [],
         };
         return this.__queryBuild__;
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
   async run<TClient extends SqlClient>(...args: SqlRunArgs<TClient, TParams>): Promise<QueryResult<TRow>> {
      const [client, params] = args;
      const _args_: SqlValuesArgs<TParams> = [params] as SqlValuesArgs<TParams>;
      return client.query<TRow>({
         text: this.getText(..._args_),
         values: this.getValues(..._args_),
      });
   }

   /**
    * Executes the query and returns exactly one row, or throw error when result not found or more
    * @param args
    */
   async one<TClient extends SqlClient>(...args: SqlRunArgs<TClient, TParams>): Promise<TRow> {
      const rows = await this.run(...args).then((res) => res.rows);
      ok(rows.length === 1, `Expected one row, actual is ${rows.length} rows.`);
      ok(rows[0], `The one row in result is not defined: ${rows[0]}`);
      return rows[0];
   }

   /**
    * Executes the query and returns the first row, or undefined when no rows found
    * @param args
    */
   async any<TClient extends SqlClient>(...args: SqlRunArgs<TClient, TParams>): Promise<TRow | undefined> {
      return this.run(...args).then((res) => (res.rows.length > 0 ? res.rows[0] : undefined));
   }

   /**
    * Executes the query and returns all rows
    * @param args
    */
   async many<TClient extends SqlClient>(...args: SqlRunArgs<TClient, TParams>): Promise<TRow[]> {
      return this.run(...args).then((res) => res.rows);
   }

   /**
    * Build the query using the context
    * @param context
    */
   build(context: SqlQueryContext): SqlBuild {
      context.queryCount++;

      switch (context.keyword) {
         case "join":
         case "from": {
            const build = this.internalBuild(context);
            return {
               strings: ["(", ...build.strings, ")", ` "${this.name}"`],
               values: build.values,
            };
         }
         default: {
            return this.internalBuild(context);
         }
      }
   }

   private internalBuild(context: SqlQueryContext): SqlBuild {
      const strings: string[] = [];
      const values = [];
      const children = [...this.rawValues];
      let i = -1;
      while (children.length) {
         i++;
         const child = children.shift();
         const rawString = this.rawStrings[i];
         ok(rawString, `Raw string expected as position ${i}`);
         strings.push(rawString);
         context.next(rawString);
         context.mode = "child";

         try {
            switch (true) {
               case Array.isArray(child): {
                  for (let j = 0, item = child[0]; j < child.length; j++, item = child[j]) {
                     if (j > 0) {
                        strings.push(", ");
                     }

                     switch (true) {
                        case item instanceof Sql: {
                           const childBuild = item.build(context);
                           strings.push(...childBuild.strings);
                           if (childBuild.values?.length) values.push(...childBuild.values);
                           break;
                        }
                        case item instanceof SqlParam:
                           values.push(item);
                           strings.push(item.wildcard);
                           break;
                        default:
                           // sql statement params
                           values.push(item);
                           strings.push(WILDCARD);
                           break;
                     }
                  }
                  break;
               }
               case child instanceof Sql: {
                  const childBuild = child.build(context);
                  strings.push(...childBuild.strings);
                  if (childBuild.values?.length) values.push(...childBuild.values);
                  break;
               }
               case child instanceof SqlParam:
                  values.push(child);
                  strings.push(child.wildcard);
                  break;
               default:
                  values.push(child);
                  strings.push(WILDCARD);
                  break;
            }
         } catch (err) {
            logger.error({ err, context: context, rawString, strings }, "Query context");
            throw err;
         }
      }

      return {
         strings,
         values,
      };
   }
}
