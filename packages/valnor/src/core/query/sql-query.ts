import { hasParams, SqlBuild, SqlBuildOptions, SqlInputArgs } from "../sql-types.js";
import { ok } from "assert";
import { SqlParam } from "./sql-param.js";
import { SqlQueryContext } from "./sql-query-context.js";
import { logger } from "../logger.js";
import { Sql } from "../sql-base.js";
import { DefaultFormatter } from "../default-formatter.js";
import { SqlSelectRow, SqlSelectRowExtended } from "./sql-select-row.js";
import { SqlQueryInfo } from "../charms/index.js";

export const WILDCARD = "?";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SqlQueryAny = SqlQuery<any>;

export class SqlQuery<T extends { Row?: unknown; Params?: unknown }> extends Sql {
   readonly ROW: T["Row"] extends Record<string, unknown> ? SqlSelectRowExtended<{ Row: T["Row"] }> : null;
   private __buildCache__?: SqlBuild = undefined;
   readonly info: SqlQueryInfo | null;

   constructor(
      public readonly rawStrings: readonly string[],
      public readonly rawValues: readonly unknown[],
   ) {
      super();
      this.info = rawValues.find((v) => v instanceof SqlQueryInfo) ?? null;
      this.ROW = (() => {
         const row = rawValues.find((v) => v instanceof SqlSelectRow);
         return row as T["Row"] extends Record<string, unknown> ? SqlSelectRowExtended<{ Row: T["Row"] }> : null;
      })();
   }

   /**
    * Gets the core cache key for the given driver and values
    * Query builds qre cache for performance optimizations
    * @param item sql | text
    * @param driver the db driver
    * @param values the core param values
    */
   getCacheKey({ item, driver, values }: GetCacheKeyArgs): string {
      const key = Object.keys(values)
         .map((v) => {
            if (Array.isArray(v)) return v.length;

            return 1;
         })
         .join(",");
      return JSON.stringify(`item=${item}driver=${driver}&key=${key}`);
   }

   /**
    * Translates the input params into ready to use core execution values.
    * Queries can use a mix of static values and dynamic parameters.
    * This function will create a ready to use array of values
    * @param params
    * @param args
    */
   getValues({ options, ...args }: SqlInputArgs<T["Params"]>): unknown[] {
      const { values } = this.buildCache(options);
      if (!values) return [];
      if (!hasParams(args)) return values ?? [];
      const results: unknown[] = [];
      for (let i = 0; i < values.length; i++) {
         const param = values[i];
         ok(param, `Param not found at position: ${i}`);
         if (!(param instanceof SqlParam)) {
            results.push(param);
            continue;
         }

         const value = args.params[param.name];
         if (Array.isArray(value)) results.push(...value);
         else results.push(value);
      }

      return results;
   }

   /**
    * Get the core text with input values and parameters replaced by the ? wildcards
    * @example select * from table where id = ? and name = ?
    */
   getSql({ options, ...args }: SqlInputArgs<T["Params"]>): string {
      const { values, strings } = this.buildCache(options);
      if (!values?.length) return strings.join("");
      if (!hasParams(args)) return strings.join("");

      for (let i = 0, str = strings[0]; i < strings.length; i++, str = strings[i]) {
         ok(str, `Token not found at position: ${i}`);
         if (str === WILDCARD) continue;
         if (!str.startsWith(SqlParam.PREFIX)) continue;

         const param = values.find((p) => p instanceof SqlParam && p.wildcard === str);
         ok(param instanceof SqlParam, `Param not found for token: ${str}`);
         const value = args.params[param.name];
         if (Array.isArray(value)) {
            strings[i] = Array(value.length).fill(WILDCARD).join(", ");
         } else {
            strings[i] = WILDCARD;
         }
      }

      return strings.join("");
   }

   /**
    * Get the core text with input values and parameters replaced by the indexed wildcards (ex. postgres)
    * @example select * from table where id = $1 and name = $2
    */
   getText(args: SqlInputArgs<T["Params"]>, format: (index: number) => string): string {
      const sql = this.getSql(args);
      const tokens = sql.split(WILDCARD);
      for (let i = 0; i < tokens.length - 1; i++) {
         tokens[i] += format(i);
      }

      return tokens.join("");
   }

   buildCache(options?: SqlBuildOptions) {
      // if (this.__buildCache__) return this.__buildCache__;
      const { tokenizer, formatter } = options ?? {};
      const context = new SqlQueryContext({ queryName: this.info?.label, tokenizer, formatter });
      this.build(context, options ?? {});
      return {
         strings: [...context.strings],
         values: [...context.values],
      };
      //
      // try {
      //    this.__buildCache__ = ;
      //    return this.__buildCache__;
      // } catch (err) {
      //    logger.error({ err, context, rawStrings: this.rawStrings }, "Error building core");
      //    throw err;
      // }
   }

   toString() {
      return this.rawStrings.join("?");
   }

   /**
    * Build the core using the context
    * @param context
    * @param options
    */
   build(context: SqlQueryContext, options?: SqlBuildOptions) {
      const wrapStart = () => {
         if (this.$$wrap) context.addStrings("(");
      };

      const wrapEnd = () => {
         if (this.$$wrap) context.addStrings(")");
      };

      switch (context.keyword) {
         case "select":
            wrapStart();
            this.buildInternal(context, options);
            wrapEnd();
            context.addStrings(` as "${context.queryName}"`);
            break;
         case "join":
            wrapStart();
            this.buildInternal(context, options);
            wrapEnd();
            context.addStrings(` as "${context.queryName}"`);
            break;
         case "from":
            wrapStart();
            this.buildInternal(context, options);
            wrapEnd();
            context.addStrings(` as "${context.queryName}"`);
            break;
         case "fn":
            context.addStrings(`"${context.queryName}"`);
            break;
         default:
            this.buildInternal(context, options);
            break;
      }
   }

   private buildInternal(context: SqlQueryContext, options?: SqlBuildOptions) {
      const children = [...this.rawValues];
      let i = -1;
      while (children.length || i < this.rawStrings.length) {
         i++;
         const rawString = i < this.rawStrings.length ? this.rawStrings[i] : undefined;
         if (rawString) {
            context.addStrings(rawString);
            context.next(rawString);
         }

         if (!children.length) break;

         const child = children.shift();

         function buildToken(item: unknown, delimiter = "") {
            const addString = (text: string) => `${text}${delimiter}`;
            switch (true) {
               case item instanceof SqlQuery:
                  item.build(context.scope({ queryName: item.info?.label }), options);
                  break;
               case item instanceof Sql:
                  item.build(context, options);
                  break;
               case !item:
                  context.addValues(item);
                  context.addStrings(addString(WILDCARD));
                  break;
               default:
                  context.addValues(item);
                  context.addStrings(addString(WILDCARD));
                  break;
            }
         }

         try {
            if (Array.isArray(child)) {
               for (let k = 0; k < child.length; k++) {
                  if (k > 0) {
                     context.addStrings(", ");
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

export interface GetCacheKeyArgs {
   item: "sql" | "text";
   driver: string;
   values: Record<string, unknown>;
}

export interface SqlQueryBuildOptions {
   formatProvider?: DefaultFormatter;
}
