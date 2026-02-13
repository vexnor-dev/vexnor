import { BuildSqlParams, SqlParam } from "./sql-param.js";
import { SqlBuildContext } from "./sql-build-context.js";
import { logger } from "../logger.js";
import { PARAMS, Sql, TYPE } from "../sql-base.js";
import { SqlQueryInfo } from "../charms/index.js";
import { hasParams, InferSelectRowByResult, SqlBuildOptions, SqlInputArgs } from "./sql-query-types.js";
import { SqlSelectAll } from "./sql-select-all.js";
import { Queue } from "../../lib/index.js";
import { SqlBuildError } from "../sql-build-error.js";
import { quote } from "../utils/index.js";
import { format } from "sql-formatter";
import { SqlQueryAll, SqlQueryRow } from "./sql-models.js";
import { SqlSelectValue } from "./sql-select-value.js";
import { SqlSelectRow } from "./sql-select-row.js";
import { newSqlSelectColumn } from "./sql-select-column.js";
import { SqlSelectCharm } from "./sql-charm.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SqlQueryAny = SqlQuery<any>;

export type SqlQueryColumns<Row> = Row extends Record<string, unknown> ? InferSelectRowByResult<Row> : unknown;

export type SqlQueryExtended<T extends { Row?: unknown; Params?: unknown }> = SqlQuery<T> & SqlQueryColumns<T["Row"]>;

export interface SqlQueryArgs {
   readonly info?: SqlQueryInfo;
   readonly rawStrings: TemplateStringsArray;
   readonly rawValues: unknown[];
   readonly isFragment?: boolean;
   readonly format?: SqlQueryFormat;
}

export type SqlQueryFormat =
   | "with:queryName as (sql)"
   | "select:(sql) as queryName"
   | "from:(sql) as queryName"
   | "join:(sql) as queryName"
   | "fn:queryName"
   | "sql";

export class SqlQuery<T extends { Row?: unknown; Params?: unknown }> extends Sql {
   declare readonly [TYPE]: T["Row"];
   declare readonly [PARAMS]: T["Params"];

   readonly rawStrings: TemplateStringsArray;
   readonly rawValues: unknown[];
   readonly info: SqlQueryInfo | null = null;
   readonly isFragment: boolean;
   readonly row: SqlQueryRow<T["Row"]>;
   readonly $$: SqlQueryAll<T["Row"]>;
   readonly params: BuildSqlParams<T["Params"]>;
   readonly format: SqlQueryFormat | null = null;

   constructor({ rawStrings, rawValues, ...args }: SqlQueryArgs) {
      super({
         ID: (() => {
            const info = args.info ?? rawValues.find((z) => z instanceof SqlQueryInfo);
            if (!info) return "#";

            return JSON.stringify(info.options).replace(`"`, "").replace(" ", "");
         })(),
      });

      this.format = args.format ?? null;
      this.params = (() => {
         let params: Partial<BuildSqlParams<T["Params"]>> | null = null;
         const queue = new Queue(...rawValues);
         for (const rawValue of queue.shift()) {
            switch (true) {
               case Array.isArray(rawValue):
                  queue.add(...rawValue);
                  break;
               case rawValue instanceof SqlParam:
                  params = {
                     ...(params ?? {}),
                     [rawValue.name]: rawValue,
                  };
                  break;
               case rawValue instanceof Sql && hasParams(rawValue):
                  params = {
                     ...(params ?? {}),
                     ...rawValue.params,
                  };
                  break;
            }
         }

         return params as BuildSqlParams<T["Params"]>;
      })();

      this.row = (() => {
         let row: Partial<SqlQueryRow<T["Row"]>> | null = null;
         const queue = new Queue(...rawValues);
         for (const rawValue of queue.shift()) {
            switch (true) {
               case Array.isArray(rawValue):
                  queue.add(...rawValue);
                  break;
               case rawValue instanceof SqlSelectCharm:
               case rawValue instanceof SqlSelectValue:
                  row = {
                     ...(row ?? {}),
                     [`$${rawValue.key}`]: newSqlSelectColumn({
                        key: rawValue.key,
                        columnName: rawValue.key,
                     }),
                  };
                  break;
               case rawValue instanceof SqlSelectRow:
                  row = {
                     ...(row ?? {}),
                     ...rawValue.row,
                  };
                  break;
            }
         }

         return row as SqlQueryRow<T["Row"]>;
      })();

      this.info = (() => {
         const queue = new Queue(...rawValues);
         for (const rawValue of queue.shift()) {
            switch (true) {
               case rawValue instanceof SqlQueryInfo:
                  return rawValue;
               case Array.isArray(rawValue):
                  queue.add(...rawValue);
                  break;
            }
         }

         return null;
      })();

      this.rawStrings = rawStrings;
      this.rawValues = rawValues;
      this.isFragment = args.isFragment ?? false;
      this.$$ = (this.row ? new SqlSelectAll(this.row) : null) as SqlQueryAll<T["Row"]>;
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
               case item instanceof SqlQuery: {
                  const queryName = context.getQueryName(item);
                  switch (item.format ?? SqlQueryFormatByKeyword[context.keyword ?? "sql"]) {
                     case "with:queryName as (sql)":
                        context.scope({ query: item, cte: true }, () => {
                           context.addStrings(`${quote(queryName)} as (`);
                           item.build(context, options);
                           context.addStrings(")");
                        });
                        break;
                     case "select:(sql) as queryName":
                        context.scope({ query: item }, () => {
                           context.addStrings("(");
                           item.build(context, options);
                           context.addStrings(")");
                           context.addStrings(` as ${quote(queryName)}`);
                        });
                        break;
                     case "join:(sql) as queryName":
                     case "from:(sql) as queryName":
                        context.scope({ query: item }, () => {
                           if (context.isCTE(item)) {
                              context.addStrings(`${quote(queryName)}`);
                           } else {
                              context.addStrings("(");
                              item.build(context, options);
                              context.addStrings(")");
                              context.addStrings(` as ${quote(queryName)}`);
                           }
                        });
                        break;
                     case "fn:queryName":
                        context.addStrings(`${quote(queryName)}`);
                        break;
                     case "sql":
                     default:
                        item.build(context, options);
                        break;
                  }
                  break;
               }
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

   render(f: SqlQueryFormat): SqlQueryExtended<T> {
      const query = new SqlQuery<T>({
         rawStrings: this.rawStrings,
         rawValues: this.rawValues,
         format: f,
         isFragment: this.isFragment,
      });
      return newSqlQuery(query);
   }
}

export function newSqlQuery<T extends { Params?: unknown; Row?: unknown }>(query: SqlQuery<T>): SqlQueryExtended<T> {
   return new Proxy(query, {
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
         if (target.row && Reflect.has(target.row, p)) return true;

         return false;
      },
      get(target, p: string | symbol, receiver: unknown): unknown {
         if (Reflect.has(target, p)) return Reflect.get(target, p, receiver);
         if (target.row && Reflect.has(target.row, p)) return Reflect.get(target.row, p, receiver);

         return undefined;
      },
   }) as SqlQueryExtended<T>;
}

export const SqlQueryFormatByKeyword: Record<string, SqlQueryFormat> = {
   with: "with:queryName as (sql)",
   from: "from:(sql) as queryName",
   select: "select:(sql) as queryName",
   join: "join:(sql) as queryName",
   fn: "fn:queryName",
   sql: "sql",
};
