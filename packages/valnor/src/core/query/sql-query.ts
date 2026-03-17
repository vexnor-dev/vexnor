import {
   hasParams,
   InferSelectRowByResult,
   SqlInputArgs,
   SqlQueryFormat,
   SqlQueryType,
} from "#/core/query/sql-query-types.js";
import { ARGS, PARAMS, Sql, TYPE } from "#/core/sql-base.js";
import { Lazy } from "#/lib/lazy.js";
import { BuildSqlParams, SqlParam } from "#/core/query/sql-param.js";
import { SqlQueryAll, SqlQueryRow } from "#/core/query/sql-models.js";
import { SqlQueryInfo } from "#/core/charms/sql-query-info.js";
import { findQueryComment } from "#/core/utils/find-query-comment.js";
import { SqlBuildContext } from "#/core/builder/sql-build-context.js";
import { SqlBuildOptions } from "#/core/builder/sql-build-options.js";
import { newSqlQueryRef, SqlQueryRef, SqlQueryRefAny, SqlQueryRefExtended } from "#/core/query/sql-query-ref.js";
import { SqlBuildError } from "#/core/sql-build-error.js";
import { Queue } from "#/lib/queue.js";
import { SqlSelectAll } from "#/core/query/sql-select-all.js";
import { SqlSelectValue } from "#/core/query/sql-select-value.js";
import { newSqlSelectColumn, SqlQueryColumn } from "#/core/query/sql-query-column.js";
import { SqlSelectRow } from "#/core/query/sql-select-row.js";
import { SqlSelectColumn } from "#/core/query/sql-select-column.js";
import { SqlSelectCharm } from "#/core/query/sql-charm.js";
import { format } from "sql-formatter";
import { SqlTable } from "#/core/schema/sql-table.js";
import { ok } from "assert";
import { isSqlLanguage } from "#/core/query/lib/is-sql-language.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SqlQueryAny = SqlQuery<any>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SqlQueryExtendedAny = SqlQueryExtended<any>;

export type SqlQueryColumns<Row> = Row extends Record<string, unknown> ? InferSelectRowByResult<Row> : unknown;

export type SqlQueryExtended<T extends { Row?: unknown; Params?: unknown }> = SqlQuery<T> & SqlQueryColumns<T["Row"]>;

export declare const QUERY: unique symbol;

export type SqlQueryArgs = Pick<SqlQueryAny, "rawStrings" | "rawValues"> &
   Partial<Pick<SqlQueryAny, "info" | "tag" | "label">>;

export class SqlQuery<T extends { Row?: unknown; Params?: unknown }> extends Sql {
   declare readonly [QUERY]: SqlQuery<Pick<T, "Row" | "Params">>;
   declare readonly [TYPE]: T["Row"];
   declare readonly [PARAMS]: T["Params"];
   declare readonly [ARGS]: T["Params"];

   readonly rawStrings: TemplateStringsArray;
   readonly rawValues: unknown[];

   private readonly _innerQueriesLazy = new Lazy<SqlQueryAny[]>(this.initInnerQueries.bind(this));
   private readonly _dialectsLazy = new Lazy<Set<string>>(this.initDialects.bind(this));
   private readonly _paramsLazy = new Lazy<BuildSqlParams<T["Params"]>>(this.initParams.bind(this));
   private readonly _rowLazy = new Lazy<SqlQueryRow<T>>(this.initRow.bind(this));
   private readonly _$$Lazy = new Lazy<SqlQueryAll<T["Row"]>>(this.initSelectAll$$.bind(this));
   private readonly _labelLazy: Lazy<string> = new Lazy(this.initLabel.bind(this));
   private readonly _infoLazy: Lazy<SqlQueryInfo | null> = new Lazy(this.initInfo.bind(this));
   private readonly _outLazy = new Lazy(this.initOut.bind(this));

   constructor({ rawStrings, rawValues, ...args }: SqlQueryArgs) {
      super({
         id: (() => {
            const comment = findQueryComment(rawStrings);
            if (comment) return comment;

            const info = args.info ?? rawValues.find((z) => z instanceof SqlQueryInfo);
            if (!info) return "";

            return Object.entries(info.options)
               .map(([k, v]) => `${k}=${v}`)
               .join(", ");
         })(),
         tag: args.tag,
      });

      this.rawStrings = rawStrings;
      this.rawValues = rawValues;
   }

   get info(): SqlQueryInfo | null {
      return this._infoLazy.value;
   }

   get label(): string {
      return this._labelLazy.value;
   }

   /**
    * SQL query parameters
    */
   get params(): BuildSqlParams<T["Params"]> {
      return this._paramsLazy.value;
   }

   /**
    * SQL query result row
    */
   get row(): SqlQueryRow<T> {
      return this._rowLazy.value;
   }

   /**
    * SQL query inner queries
    */
   get innerQueries(): SqlQueryAny[] {
      return this._innerQueriesLazy.value;
   }

   get dialects(): Set<string> {
      return this._dialectsLazy.value;
   }

   /**
    * SQL query $$ (SQL *)
    */
   get $$(): SqlQueryAll<T["Row"]> {
      return this._$$Lazy.value;
   }

   get out(): SqlQueryRefExtended<T> {
      return this._outLazy.value;
   }

   static buildInnerQueryRef(
      queryRef: SqlQueryAny | SqlQueryRefAny,
      context: SqlBuildContext,
      options?: SqlBuildOptions | null,
   ) {
      let query = undefined;
      let scope = undefined;
      switch (true) {
         case queryRef instanceof SqlQueryRef:
            if (queryRef.recursive) {
               queryRef.build(context, options);
               return;
            }

            query = queryRef.innerQuery;
            scope = queryRef.scope;
            break;
         case queryRef instanceof SqlQuery:
            query = queryRef;
            break;
         default:
            throw new SqlBuildError(
               `Unsupported query ref type: ${(queryRef as { constructor: { name: string } }).constructor.name}`,
            );
      }

      switch (scope?.queryFormat ?? SqlQueryFormatByKeyword[context.keyword ?? "default"] ?? null) {
         case "with": {
            const queryName = context.getQueryName(query);
            context.addStrings(`"${queryName}" as (`);
            query.build(context, options, { queryType: "main", cte: true });
            context.addStrings(")");
            break;
         }
         case "select": {
            const queryName = context.getQueryName(query);
            context.addStrings("(");
            query.build(context, options, { queryType: "main", cte: false });
            context.addStrings(")");
            context.addStrings(` as "${queryName}"`);
            break;
         }
         case "join":
         case "from": {
            const queryName = context.getQueryName(query);
            if (context.isCTE(query)) {
               context.addStrings(`"${queryName}"`);
            } else {
               context.addStrings("(");
               query.build(context, options, { queryType: "main", cte: false });
               context.addStrings(")");
               context.addStrings(` as "${queryName}"`);
            }
            break;
         }
         case "fn": {
            const queryName = context.getQueryName(query);
            context.addStrings(`"${queryName}"`);
            break;
         }
         case "default":
         case null:
            query.build(context, options, {
               queryType: scope?.queryType ?? "main",
               queryFormat: scope?.queryFormat ?? "default",
               cte: false,
            });
            break;
         default:
            throw new SqlBuildError(`Unsupported query format: ${scope?.queryFormat}`);
      }
   }

   static buildInnerToken(token: unknown, context: SqlBuildContext, options?: SqlBuildOptions | null) {
      switch (true) {
         case token instanceof SqlQuery:
         case token instanceof SqlQueryRef:
            this.buildInnerQueryRef(token, context, options);
            break;
         case token instanceof Sql:
            token.build(context, options ?? undefined);
            break;
         case !token:
            context.addValues(token);
            break;
         default:
            context.addValues(token);
            break;
      }
   }

   write<SqlQueryScope>(
      context: SqlBuildContext,
      options: SqlBuildOptions | null = null,
      scope?: SqlQueryScope | null,
   ) {
      context.scope(
         this,
         () => {
            const queryName = context.getQueryName(this);
            // TODO: include additional tracing in sql-query.build(): ${this.fragment ? "fragment " : ""}format="${this.format}"
            context.addStrings(` /* <${queryName}> */ `);
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

               if (Array.isArray(child)) {
                  for (let k = 0; k < child.length; k++) {
                     if (k > 0) {
                        context.addStrings(", ");
                     }

                     SqlQuery.buildInnerToken(child[k], context, options);
                  }
               } else {
                  SqlQuery.buildInnerToken(child, context, options);
               }
            }

            context.addStrings(`/* </${queryName}> */`);
         },
         scope ?? { queryType: "main", cte: false },
      );
   }

   initInfo(rawValues = this.rawValues): SqlQueryInfo | null {
      const queue = new Queue(rawValues);
      for (const rawValue of queue.shift()) {
         switch (true) {
            case rawValue instanceof SqlQueryInfo:
               return rawValue;
            case Array.isArray(rawValue):
               queue.push(...rawValue);
               break;
         }
      }

      return null;
   }

   initSelectAll$$() {
      if (!this.row) return null as SqlQueryAll<T["Row"]>;
      return new SqlSelectAll({ row: this.row, innerQuery: this }) as SqlQueryAll<T["Row"]>;
   }

   initLabel(rawStrings = this.rawStrings, rawValues = this.rawValues): string {
      const comment = findQueryComment(rawStrings);
      return (
         comment ??
         this.info?.label ??
         this.id +
            ": " +
            rawStrings
               .map((rawString, index) => {
                  const rawValue = rawValues.at(index);
                  switch (true) {
                     case rawValue === null:
                        return rawString;
                     case rawValue instanceof SqlQuery:
                        return `${rawString} (${rawValue.label})`;
                     case rawValue instanceof SqlQueryRef:
                        return `${rawString} (${rawValue.innerQuery.label})`;
                     case rawValue instanceof SqlParam:
                        return `${rawString} $${rawValue.name}`;
                     case rawValue instanceof Sql:
                        return `${rawString} ${rawValue.id}`;
                     default:
                        return `${rawString}` + rawValue ? ` ${rawValue}` : "";
                  }
               })
               .join(" ")
      );
   }

   initDialects(rawValues = this.rawValues): Set<string> {
      const result = new Set<string>();
      const q = new Queue(rawValues);
      for (const rawValue of q.shift()) {
         switch (true) {
            case Array.isArray(rawValue):
               q.push(...rawValue);
               break;
            case rawValue instanceof SqlTable:
               result.add(rawValue.dialect);
               break;
            case rawValue instanceof SqlQuery:
               for (const d of rawValue.dialects) result.add(d);
               break;
            case rawValue instanceof SqlSelectRow:
               for (const item of Object.values(rawValue.getRow({ query: this }))) q.push(item);
               break;
            case rawValue instanceof SqlSelectValue:
               q.push(rawValue.innerQuery);
               break;
            case rawValue instanceof SqlQueryColumn:
               q.push(rawValue.target);
               break;
         }
      }
      return result;
   }

   initInnerQueries(rawValues = this.rawValues): SqlQueryAny[] {
      const results: SqlQueryAny[] = [];
      const q = new Queue(rawValues);
      for (const rawValue of q.shift()) {
         switch (true) {
            case Array.isArray(rawValue):
               q.push(...rawValue);
               break;
            case rawValue instanceof SqlQuery:
               results.push(rawValue);
               results.push(...rawValue.innerQueries);
               break;
            case rawValue instanceof SqlSelectValue:
               results.push(rawValue.innerQuery);
               break;
            case rawValue instanceof SqlQueryColumn:
               results.push(rawValue.query);
               q.push(rawValue.target);
               break;
            case rawValue instanceof SqlSelectRow:
               for (const item of Object.values(rawValue.getRow({ query: this }))) {
                  q.push(item);
               }
               break;
         }
      }

      return results;
   }

   initRow(rawValues = this.rawValues): SqlQueryRow<T> {
      let row: Partial<SqlQueryRow<T>> | null = null;
      const q = new Queue(rawValues);
      for (const rawValue of q.shift()) {
         switch (true) {
            case Array.isArray(rawValue):
               q.push(...rawValue);
               break;
            case rawValue instanceof SqlSelectAll:
               break;
            case rawValue instanceof SqlSelectColumn:
            case rawValue instanceof SqlSelectCharm:
            case rawValue instanceof SqlSelectValue: {
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

   initParams(rawValues = this.rawValues): BuildSqlParams<T["Params"]> {
      let params: Partial<BuildSqlParams<T["Params"]>> | null = null;
      const q = new Queue(rawValues);
      for (const rawValue of q.shift()) {
         switch (true) {
            case Array.isArray(rawValue):
               q.push(...rawValue);
               break;
            case rawValue instanceof SqlParam:
               params = { ...(params ?? {}), [rawValue.name]: rawValue };
               break;
            case rawValue instanceof SqlQueryRef:
               if (rawValue.innerQuery.params) params = { ...(params ?? {}), ...rawValue.innerQuery.params };
               break;
            case rawValue instanceof Sql && hasParams(rawValue):
               params = { ...(params ?? {}), ...rawValue.params };
               break;
         }
      }

      return params as BuildSqlParams<T["Params"]>;
   }

   initOut(): SqlQueryRefExtended<T> {
      return newSqlQueryRef(this, null, true);
   }

   /**
    * Get the SQL  text with input values and parameters replaced by the ? wildcards
    * @example select * from table where id = ? and name = ?
    */
   getSql({ options, ...args }: SqlInputArgs<T["Params"]>): { text: string; values: unknown[] } {
      const dialect = options?.dialect ?? this.dialects.values().next().value ?? "sql";
      ok(isSqlLanguage(dialect), `Invalid dialect: ${dialect}`);

      const context = new SqlBuildContext({
         dialect,
         ...options,
         params: hasParams(args) ? Object.freeze(args.params) : {},
      });
      this.build(context, options ?? null, { queryType: "main" });
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
      const shouldFormat = options?.format ?? process.env.NODE_ENV !== "production";
      if (!shouldFormat) return { text, values };
      try {
         return {
            text: format(text, {
               language: context.dialect,
               keywordCase: "upper",
            }),
            values,
         };
      } catch (err) {
         throw new SqlBuildError(`Failed to format SQL using dialect '${context.dialect}'.\n${text}`, { cause: err });
      }
   }

   render(queryFormat: SqlQueryFormat, queryType?: SqlQueryType | null): SqlQueryRefExtended<T> {
      return newSqlQueryRef(this, { queryFormat, queryType });
   }

   inline(queryFormat?: SqlQueryFormat | null): SqlQueryRefExtended<T> {
      return newSqlQueryRef(this, { queryType: "inline", queryFormat });
   }
}

export function newSqlQuery<T extends { Params?: unknown; Row?: unknown }, Handler extends SqlQuery<T>>(
   query: Handler,
): Handler & SqlQueryExtended<T> {
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
   }) as Handler & SqlQueryExtended<T>;
}

export const SqlQueryFormatByKeyword: Record<string, SqlQueryFormat> = {
   "with recursive": "with",
   recursive: "with",
   with: "with",
   from: "from",
   select: "select",
   join: "join",
   fn: "fn",
   default: "default",
   in: "default",
   exists: "default",
};
