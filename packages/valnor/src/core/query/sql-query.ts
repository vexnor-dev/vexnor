import { SqlParam, SqlParamAny } from "./sql-param.js";
import { SqlBuildContext } from "./sql-build-context.js";
import { logger } from "../logger.js";
import { Sql } from "../sql-base.js";
import { SqlQueryInfo } from "../charms/index.js";
import { hasParams, InferSelectRowByResult, SqlBuildOptions, SqlInputArgs } from "./sql-query-types.js";
import { SqlSelectAll } from "./sql-select-all.js";
import { Queue } from "../../lib/index.js";
import { SqlSelectRow } from "./sql-select-row.js";
import { SqlBuildError } from "../sql-build-error.js";
import { SqlSelectValue } from "./sql-select-value.js";
import { newSqlSelectColumn } from "./sql-select-column.js";
import { quote } from "../utils/index.js";
import { format } from "sql-formatter";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SqlQueryAny = SqlQuery<any>;

export type SqlQueryColumns<T extends { Params?: unknown; Row?: unknown }> =
   T["Row"] extends Record<string, unknown> ? InferSelectRowByResult<T["Row"]> : unknown;

export type SqlQueryExtended<T extends { Row?: unknown; Params?: unknown }> = SqlQuery<T> & SqlQueryColumns<T>;

export interface SqlQueryArgs {
   readonly info?: SqlQueryInfo;
   readonly rawStrings: TemplateStringsArray;
   readonly rawValues: unknown[];
   readonly isFragment?: boolean;
}

type SqlQueryRow<T> = T extends { Row: Record<string, unknown> } ? InferSelectRowByResult<T["Row"]> : null;
type SqlQueryAll<T> = T extends { Row: Record<string, unknown> } ? SqlSelectAll<T> : null;
export type SqlQueryParams<T> = T extends { Params: Record<infer Key extends string, infer Type> }
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
      let info: SqlQueryInfo | null = null;
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
               info = rawValue;
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
                  [`$${rawValue.key}`]: newSqlSelectColumn({
                     key: rawValue.key,
                     columnName: rawValue.key,
                  }),
               };
               params = {
                  ...(params ?? {}),
                  ...rawValue.query.params,
               };
               break;
            case Array.isArray(rawValue):
               queue.add(...rawValue);
               break;
         }
      }
      this.row = row as SqlQueryRow<T>;
      this.info = info;
      this.params = params as SqlQueryParams<T>;
      this.$$ = (this.row ? new SqlSelectAll(this.row) : null) as SqlQueryAll<T>;
   }

   /**
    * Get the core text with input values and parameters replaced by the ? wildcards
    * @example select * from table where id = ? and name = ?
    */
   getSql({ options, ...args }: SqlInputArgs<T["Params"]>): { text: string; values: unknown[] } {
      const context = new SqlBuildContext({ query: this, ...options });
      this.build(context, options ?? {});
      const paramFormat = options?.paramFormat ?? (() => "?");
      const tokens: string[] = [];
      const values = [];

      for (const token of context.tokens) {
         switch (token.type) {
            case "text":
               tokens.push(token.value);
               break;
            case "value": {
               if (Array.isArray(token.value)) {
                  for (let i = 0; i < token.value.length; i++) {
                     if (i > 0) {
                        tokens.push(", ");
                     }

                     tokens.push(paramFormat({ index: values.length }));
                     tokens.push(",");
                     values.push(token.value[i]);
                  }
                  break;
               }

               tokens.push(paramFormat({ index: values.length }));
               values.push(token.value);
               break;
            }
            case "param": {
               if (!hasParams(args)) {
                  throw new SqlBuildError(`Param value not provided for param: ${token.name}`);
               }

               const value = args.params[token.name];
               if (Array.isArray(value)) {
                  for (let i = 0; i < value.length; i++) {
                     if (i > 0) {
                        tokens.push(", ");
                     }

                     tokens.push(paramFormat({ name: token.name, index: values.length }));
                     values.push(value[i]);
                  }
                  break;
               }

               tokens.push(paramFormat({ name: token.name, index: values.length }));
               values.push(value);
               break;
            }
            default:
               throw new SqlBuildError(`Unknown token type ${typeof token}: ${token}`);
         }
      }

      const text = tokens.join("");
      try {
         return {
            text: format(text, {
               language: options?.dialect ?? "sql",
               keywordCase: "upper",
            }),
            values,
         };
      } catch (err) {
         console.error("Failed to format:\n", text);
         throw err;
      }
   }

   build(context: SqlBuildContext, options?: SqlBuildOptions) {
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

         const buildToken = (item: unknown) => {
            switch (true) {
               case item instanceof SqlQuery:
                  switch (context.keyword) {
                     case "with":
                        context.scope({ query: item, cte: true }, () => {
                           context.addStrings(`${quote(context.getQueryName(item))} as (`);
                           item.build(context, options);
                           context.addStrings(")");
                        });
                        break;
                     case "select":
                        context.scope({ query: item }, () => {
                           context.addStrings("(");
                           item.build(context, options);
                           context.addStrings(")");
                           context.addStrings(` as ${quote(context.getQueryName(item))}`);
                        });
                        break;
                     case "join":
                     case "from":
                        context.scope({ query: item }, () => {
                           if (context.isCTE(item)) {
                              context.addStrings(`${quote(context.getQueryName(item))}`);
                           } else {
                              context.addStrings("(");
                              item.build(context, options);
                              context.addStrings(")");
                              context.addStrings(` as ${quote(context.getQueryName(item))}`);
                           }
                        });
                        break;
                     case "fn":
                        context.addStrings(`${quote(context.getQueryName(item))}`);
                        break;
                     default:
                        item.build(context, options);
                        break;
                  }
                  break;
               case item instanceof Sql:
                  item.build(context, options);
                  break;
               case !item:
                  context.addValues(item);
                  break;
               default:
                  context.addValues(item);
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
