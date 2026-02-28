import { BuildSqlParams, SqlParam } from "./sql-param.js";
import { SqlBuildContext } from "./sql-build-context.js";
import { logger } from "../logger.js";
import { PARAMS, Sql, TYPE } from "../sql-base.js";
import { SqlQueryInfo } from "../charms/index.js";
import { hasParams, InferSelectRowByResult, SqlBuildOptions, SqlInputArgs } from "./sql-query-types.js";
import { SqlSelectAll } from "./sql-select-all.js";
import { indexedArray, Lazy, Queue } from "../../lib/index.js";
import { SqlBuildError } from "../sql-build-error.js";
import { format } from "sql-formatter";
import { SqlQueryRow, SqlQueryAll } from "./sql-models.js";
import { SqlSelectValue } from "./sql-select-value.js";
import { SqlSelectRow } from "./sql-select-row.js";
import { SqlSelectCharm } from "./sql-charm.js";
import console from "node:console";
import { newSqlSelectColumn, SqlQueryColumn } from "./sql-query-column.js";
import { SqlSelectColumn } from "./sql-select-column.js";
import { ok } from "assert";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SqlQueryAny = SqlQuery<any>;

export type SqlQueryColumns<Row> = Row extends Record<string, unknown> ? InferSelectRowByResult<Row> : unknown;

export type SqlQueryExtended<T extends { Row?: unknown; Params?: unknown }> = SqlQuery<T> & SqlQueryColumns<T["Row"]>;

export declare const QUERY: unique symbol;

export type QueryOf<S> = S extends { readonly [QUERY]?: infer R } ? R : unknown;

export type SqlQueryArgs = Pick<SqlQueryAny, "rawStrings" | "rawValues"> &
   Partial<Pick<SqlQueryAny, "info" | "inline" | "format">>;

export type SqlQueryFormat = "with" | "select" | "from" | "join" | "fn" | "sql";

export class SqlQuery<T extends { Row?: unknown; Params?: unknown }> extends Sql {
   declare readonly [QUERY]: SqlQuery<Pick<T, "Row" | "Params">>; // phantom, public

   declare readonly [TYPE]: T["Row"];
   declare readonly [PARAMS]: T["Params"];

   readonly rawStrings: TemplateStringsArray;
   readonly rawValues: unknown[];
   readonly info: SqlQueryInfo | null = null;
   readonly inline: boolean;
   readonly format: SqlQueryFormat | null = null;

   private readonly _queries = new Lazy<SqlQueryAny[]>(this.createQueries.bind(this));
   private readonly _params = new Lazy<BuildSqlParams<T["Params"]>>(this.createParams.bind(this));
   private readonly _row = new Lazy<SqlQueryRow<T>>(this.createRow.bind(this));
   private readonly _$$ = new Lazy<SqlQueryAll<T["Row"]>>(() => {
      if (!this.row) return null as SqlQueryAll<T["Row"]>;
      return new SqlSelectAll({ row: this.row, query: this }) as SqlQueryAll<T["Row"]>;
   });
   constructor({ rawStrings, rawValues, ...args }: SqlQueryArgs) {
      super({
         id: (() => {
            const info = args.info ?? rawValues.find((z) => z instanceof SqlQueryInfo);
            if (!info) return "";

            return Object.entries(info.options)
               .map(([k, v]) => `${k}=${v}`)
               .join(", ");
         })(),
      });

      this.rawStrings = rawStrings;
      this.rawValues = rawValues;
      this.format = args.format ?? null;
      this.info = this.findInfo();
      this.inline = args.inline ?? this.info?.inline ?? false;
   }

   /**
    * SQL query parameters
    */
   get params() {
      return this._params.value;
   }

   /**
    * SQL query result row
    */
   get row() {
      return this._row.value;
   }

   /**
    * SQL query inner queries
    */
   get queries() {
      return this._queries.value;
   }

   /**
    * SQL query $$ (SQL *)
    */
   get $$() {
      return this._$$.value;
   }

   findInfo(rawValues = this.rawValues) {
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
   }

   createQueries(rawValues = this.rawValues) {
      const queries: SqlQueryAny[] = [];
      const q = new Queue(...rawValues);
      for (const rawValue of q.shift()) {
         switch (true) {
            case Array.isArray(rawValue):
               q.add(...rawValue);
               break;
            case rawValue instanceof SqlQuery:
               queries.push(rawValue);
               queries.push(...rawValue.queries);
               break;
            case rawValue instanceof SqlSelectValue:
               queries.push(rawValue.query);
               break;
            case rawValue instanceof SqlQueryColumn:
               queries.push(rawValue.query);
               q.add(rawValue.target);
               break;
            case rawValue instanceof SqlSelectRow:
               for (const item of Object.values(rawValue.getRow({ query: this }))) {
                  q.add(item);
               }
               break;
         }
      }

      return queries;
   }

   createRow(rawValues = this.rawValues): SqlQueryRow<T> {
      let row: Partial<SqlQueryRow<T>> | null = null;
      const q = new Queue(...rawValues);
      for (const rawValue of q.shift()) {
         switch (true) {
            case Array.isArray(rawValue):
               q.add(...rawValue);
               break;
            case rawValue instanceof SqlSelectAll:
               console.log(`row >> SqlSelectAll: ${this.id} -> ${rawValue.id}`);
               break;
            case rawValue instanceof SqlSelectColumn:
            case rawValue instanceof SqlSelectCharm:
            case rawValue instanceof SqlSelectValue: {
               console.log(`row >> SqlSelectValue: ${this.id} -> ${rawValue.id}`);
               row = {
                  ...(row ?? {}),
                  [`$${rawValue.key}`]: newSqlSelectColumn({ target: rawValue, key: rawValue.key, query: this }),
               };
               break;
            }
            case rawValue instanceof SqlSelectRow:
               for (const [key, item] of Object.entries(rawValue.getRow({ query: this }))) {
                  row = {
                     ...(row ?? {}),
                     [key]: item,
                  };
               }
               break;
         }
      }

      return row as SqlQueryRow<T>;
   }

   createParams(rawValues = this.rawValues) {
      let params: Partial<BuildSqlParams<T["Params"]>> | null = null;
      const q = new Queue(...rawValues);
      for (const rawValue of q.shift()) {
         switch (true) {
            case Array.isArray(rawValue):
               q.add(...rawValue);
               break;
            case rawValue instanceof SqlParam:
               params = { ...(params ?? {}), [rawValue.name]: rawValue };
               break;
            case rawValue instanceof Sql && hasParams(rawValue):
               params = { ...(params ?? {}), ...rawValue.params };
               break;
         }
      }

      return params as BuildSqlParams<T["Params"]>;
   }

   /**
    * Get the core text with input values and parameters replaced by the ? wildcards
    * @example select * from table where id = ? and name = ?
    */
   getSql({ options, ...args }: SqlInputArgs<T["Params"]>): { text: string; values: unknown[] } {
      const context = new SqlBuildContext({ ...options, params: hasParams(args) ? args.params : undefined });
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
            case "expand": {
               ok("params" in args, "'args.params' is required to expand.");
               const expanded = token.expand(args.params);
               if (Array.isArray(expanded)) {
                  for (const { index, item } of indexedArray(expanded)) {
                     if (index > 0) {
                        tokens.push(", ");
                     }

                     item.build(context, options);
                  }
               }
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

   buildToken(token: unknown, context: SqlBuildContext, options?: SqlBuildOptions) {
      switch (true) {
         case token instanceof SqlQuery: {
            switch (token.format ?? SqlQueryFormatByKeyword[context.keyword ?? "sql"]) {
               case "with":
                  context.scope({ query: token, cte: true, inline: token.inline }, () => {
                     const queryName = context.getQueryName(token);
                     context.addStrings(`"${queryName}" as (`);
                     token.build(context, options);
                     context.addStrings(")");
                  });
                  break;
               case "select":
                  context.scope({ query: token, inline: this.inline }, () => {
                     const queryName = context.getQueryName(token);
                     context.addStrings("(");
                     token.build(context, options);
                     context.addStrings(")");
                     context.addStrings(` as "${queryName}"`);
                  });
                  break;
               case "join":
               case "from":
                  context.scope({ query: token, inline: this.inline }, () => {
                     const queryName = context.getQueryName(token);
                     if (context.isCTE(token)) {
                        context.addStrings(`"${queryName}"`);
                     } else {
                        context.addStrings("(");
                        token.build(context, options);
                        context.addStrings(")");
                        context.addStrings(` as "${queryName}"`);
                     }
                  });
                  break;
               case "fn":
                  context.scope({ query: token, inline: this.inline }, () => {
                     const queryName = context.getQueryName(token);
                     context.addStrings(`"${queryName}"`);
                  });
                  break;
               case "sql":
               default:
                  context.scope({ query: token, inline: this.inline }, () => {
                     token.build(context, options);
                  });
                  break;
            }
            break;
         }
         case token instanceof Sql:
            token.build(context, options);
            break;
         case !token:
            context.addValues(token);
            break;
         default:
            context.addValues(token);
            break;
      }
   }

   build(context: SqlBuildContext, options?: SqlBuildOptions) {
      context.scope({ query: this }, () => {
         const queryName = context.getQueryName(this);
         context.addStrings(`\n\n/* <${queryName}> */\n\n`);
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

            try {
               if (Array.isArray(child)) {
                  for (let k = 0; k < child.length; k++) {
                     if (k > 0) {
                        context.addStrings(", ");
                     }

                     this.buildToken(child[k], context, options);
                  }
               } else {
                  this.buildToken(child, context, options);
               }
            } catch (err) {
               logger.error(
                  { err, context: context, rawString, child: child instanceof Sql ? child : "xxx" },
                  "Query context",
               );
               throw err;
            }
         }

         context.addStrings(`\n\n/* </${queryName}> */\n\n`);
      });
   }

   render(args: { format?: SqlQueryFormat; inline?: boolean }): SqlQueryExtended<T> {
      const query = new SqlQuery<T>({
         rawStrings: this.rawStrings,
         rawValues: this.rawValues,
         format: args.format ?? this.format ?? undefined,
         inline: args.inline ?? this.inline,
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
         return Boolean(target.row && Reflect.has(target.row, p));
      },
      get(target, p: string | symbol, receiver: unknown): unknown {
         if (Reflect.has(target, p)) return Reflect.get(target, p, receiver);
         if (target.row && Reflect.has(target.row, p)) return Reflect.get(target.row, p, receiver);

         return undefined;
      },
   }) as SqlQueryExtended<T>;
}

export const SqlQueryFormatByKeyword: Record<string, SqlQueryFormat> = {
   with: "with",
   from: "from",
   select: "select",
   join: "join",
   fn: "fn",
   sql: "sql",
};
