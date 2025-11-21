import { ok } from "assert";
import { SqlParam, SqlParamAny } from "./sql-param.js";
import { SqlBuildContext } from "./sql-build-context.js";
import { logger } from "../logger.js";
import { Sql } from "../sql-base.js";
import { SqlSelectRow } from "./sql-select-row.js";
import { SqlQueryInfo } from "../charms/index.js";
import { hasParams, InferSelectRowByResult, SqlBuildOptions, SqlInputArgs } from "./sql-query-types.js";
import { SqlSelectAll } from "./sql-select-all.js";
import { SqlSelectValue } from "./sql-select-value.js";
import { SqlBuildError } from "../sql-build-error.js";
import { Queue } from "../../lib/index.js";

export const WILDCARD = "?";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SqlQueryAny = SqlQuery<any>;

export type SqlQueryExtended<T extends { Row?: unknown; Params?: unknown }> = SqlQuery<{
   Row: T["Row"];
   Params: T["Params"];
}> &
   (T extends { Row: Record<string, unknown> } ? InferSelectRowByResult<T["Row"]> : unknown) & {
      $$: T extends { Row: Record<string, unknown> } ? SqlSelectAll<T> : unknown;
   };

export interface SqlQueryArgs {
   readonly info?: SqlQueryInfo;
   readonly rawStrings: TemplateStringsArray;
   readonly rawValues: unknown[];
   readonly isFragment?: boolean;
}

type SqlQueryRow<T> = T extends { Row: Record<string, unknown> } ? InferSelectRowByResult<T["Row"]> : null;
type SqlQueryAll<T> = T extends { Row: Record<string, unknown> } ? SqlSelectAll<T> : null;
type SqlQueryParams<T> = T extends { Params: Record<infer Key extends string, infer Type> }
   ? Record<Key, SqlParam<{ Name: Key; Type: Type }>>
   : null;

export class SqlQuery<T extends { Row?: unknown; Params?: unknown }> extends Sql {
   readonly rawStrings: TemplateStringsArray;
   readonly rawValues: unknown[];
   readonly info: SqlQueryInfo | null = null;
   readonly isFragment: boolean;
   readonly params: SqlQueryParams<T>;
   readonly row: SqlQueryRow<T>;
   readonly $$: SqlQueryAll<T>;

   constructor({ rawStrings, rawValues, ...args }: SqlQueryArgs) {
      super({
         ID: (() => {
            const info = args.info ?? rawValues.find((z) => z instanceof SqlQueryInfo);
            if (!info) return "#";

            return JSON.stringify(info.options).replace(`"`, "").replace(" ", "");
         })(),
      });
      this.rawStrings = rawStrings;
      this.rawValues = rawValues;
      this.isFragment = args.isFragment ?? false;

      let params: Record<string, SqlParamAny> | null = null;
      let row: Record<string, unknown> | null = null;
      let hasRow = false;

      const queue = new Queue(...rawValues);
      for (const rawValue of queue.shift()) {
         switch (true) {
            case rawValue instanceof SqlParam:
               params = {
                  ...(params ?? {}),
                  [rawValue.name]: rawValue,
               };
               break;
            case rawValue instanceof SqlQueryInfo:
               this.info = rawValue;
               break;
            case rawValue instanceof SqlSelectRow:
               if (hasRow) {
                  throw new SqlBuildError(
                     `SqlQuery can only have one row() defined. This row() cannot be processed: ${rawValue}`,
                  );
               }

               row = {
                  ...rawValue.row,
               };
               hasRow = true;
               break;
            case rawValue instanceof SqlQuery:
               if (rawValue.params) {
                  params = {
                     ...(params ?? {}),
                     ...rawValue.params,
                  };
               }
               break;
            case rawValue instanceof SqlSelectValue:
               row = {
                  ...(row ?? {}),
                  [rawValue.key]: rawValue,
               };
               break;
            case Array.isArray(rawValue):
               queue.add(...rawValue);
               break;
         }
      }

      this.params = params as SqlQueryParams<T>;
      this.row = row as SqlQueryRow<T>;
      if (this.row) {
         this.$$ = new SqlSelectAll(this.row) as SqlQueryAll<T>;
      } else {
         this.$$ = null as SqlQueryAll<T>;
      }
   }

   /**
    * Translates the input params into ready to use core execution values.
    * Queries can use a mix of static values and dynamic parameters.
    * This function will create a ready to use array of values
    * @param params
    * @param args
    */
   getValues({ options, ...args }: SqlInputArgs<T["Params"]>): unknown[] {
      const { values } = this.buildQuery(options);
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
      const { values, strings } = this.buildQuery(options);
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

   buildQuery(options?: SqlBuildOptions) {
      // if (this.__buildCache__) return this.__buildCache__;
      const { tokenizer, formatter } = options ?? {};
      const context = new SqlBuildContext({ query: this, tokenizer, formatter });
      this.build(context, options ?? {});
      return {
         strings: [...context.strings],
         values: [...context.values],
      };
   }

   /**
    * Build the core using the context
    * @param context
    * @param options
    */
   build(context: SqlBuildContext, options?: SqlBuildOptions) {
      const wrapStart = () => {
         if (this.wrap) context.addStrings("(");
      };

      const wrapEnd = () => {
         if (this.wrap) context.addStrings(")");
      };

      switch (this.isFragment ? null : context.keyword) {
         case "select":
            wrapStart();
            this.buildInternal(context, options);
            wrapEnd();
            context.addStrings(` as "${context.getQueryName(this)}"`);
            break;
         case "join":
            wrapStart();
            this.buildInternal(context, options);
            wrapEnd();
            context.addStrings(` as "${context.getQueryName(this)}"`);
            break;
         case "from":
            wrapStart();
            this.buildInternal(context, options);
            wrapEnd();
            context.addStrings(` as "${context.getQueryName(this)}"`);
            break;
         case "fn":
            context.addStrings(`"${context.getQueryName(this)}"`);
            break;
         default:
            this.buildInternal(context, options);
            break;
      }
   }

   private buildInternal(context: SqlBuildContext, options?: SqlBuildOptions) {
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

         const buildToken = (item: unknown, delimiter = "") => {
            const addString = (text: string) => `${text}${delimiter}`;
            switch (true) {
               case item instanceof SqlQuery: {
                  item.build(context.trackQuery(item), options);
                  break;
               }
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
         };

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
