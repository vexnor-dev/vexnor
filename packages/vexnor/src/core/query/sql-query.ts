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
import { newSqlQueryColumn, SqlQueryColumn } from "#/core/query/sql-query-column.js";
import { SqlSelectRow } from "#/core/query/sql-select-row.js";
import { SqlSelectColumn } from "#/core/query/sql-select-column.js";
import { SqlSelectCharm } from "#/core/query/sql-charm.js";
import { getFormatter } from "#/format/formatter-registry.js";
import { SqlTable } from "#/core/schema/sql-table.js";
import { ok } from "#/lib/assert.js";
import { isSqlLanguage } from "#/core/query/lib/is-sql-language.js";
import { isPrimitive } from "#/lib/primitive.js";
import { SqlExpand } from "#/core/query/sql-expand.js";
import { getDefaultParamFormat } from "#/core/query/default-param-format.js";
import { SqlJsonSchema } from "#/core/utils/sql-json-schema.js";
import { parseCallerLocation } from "#/core/utils/caller-location.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SqlQueryAny = SqlQuery<any>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SqlQueryExtendedAny = SqlQueryExtended<any>;

export type SqlQueryColumns<Row> = Row extends Record<string, unknown> ? InferSelectRowByResult<Row> : unknown;

export type SqlQueryExtended<T extends { Row?: unknown; Params?: unknown }> = SqlQuery<T> & SqlQueryColumns<T["Row"]>;

export declare const QUERY: unique symbol;

export type SqlQueryArgs = Pick<SqlQueryAny, "rawStrings" | "rawValues"> &
   Partial<Pick<SqlQueryAny, "info" | "tag" | "label">> & { authorization?: string | null };

export class SqlQuery<T extends { Row?: unknown; Params?: unknown }> extends Sql {
   declare readonly [QUERY]: SqlQuery<Pick<T, "Row" | "Params">>;
   declare readonly [TYPE]: T["Row"];
   declare readonly [PARAMS]: T["Params"];
   declare readonly [ARGS]: T["Params"];

   readonly rawStrings: TemplateStringsArray;
   readonly rawValues: unknown[];
   readonly location: string | null;
   protected _authorization: string | null;

   private readonly _innerQueriesLazy = new Lazy<SqlQueryAny[]>(this.initInnerQueries.bind(this));
   private readonly _dialectsLazy = new Lazy<Set<string>>(this.initDialects.bind(this));
   private readonly _paramsLazy = new Lazy<BuildSqlParams<T["Params"]>>(this.initParams.bind(this));
   private readonly _rowLazy = new Lazy<SqlQueryRow<T>>(this.initRow.bind(this));
   private readonly _$$Lazy = new Lazy<SqlQueryAll<T["Row"]>>(this.initSelectAll$$.bind(this));
   private readonly _labelLazy: Lazy<string> = new Lazy(this.initLabel.bind(this));
   private readonly _infoLazy: Lazy<SqlQueryInfo | null> = new Lazy(this.initInfo.bind(this));
   private readonly _outLazy = new Lazy(this.initOut.bind(this));
   private readonly _hashLazy = new Lazy<Promise<string>>(this.initHash.bind(this));
   private readonly _jsonSchemaLazy = new Lazy<SqlJsonSchema>(this.initJsonSchema.bind(this));

   constructor({ rawStrings, rawValues, ...args }: SqlQueryArgs) {
      super({
         type: "SqlQuery",
         id: (() => {
            const comment = findQueryComment(rawStrings);
            if (comment) return comment;

            const info = args.info ?? rawValues.find((z) => z instanceof SqlQueryInfo);
            if (!info) return "";

            return Object.entries(info.options)
               .map(([k, v]) => `${k}=${v}`)
               .join(", ");
         })(),
         hashId:
            JSON.stringify(Array.from(rawStrings)) +
            "|" +
            rawValues.map((v) => (v instanceof Sql ? v.hashId : String(v))).join("|"),
         tag: args.tag,
      });

      this.rawStrings = rawStrings;
      this.rawValues = rawValues;
      this.location = parseCallerLocation(new Error().stack);
      this._authorization = args.authorization ?? null;
   }

   get authorization() {
      return this._authorization;
   }

   get info(): SqlQueryInfo | null {
      return this._infoLazy.value;
   }

   get label(): string {
      return this._labelLazy.value;
   }

   /** Named parameter accessors for this query, keyed as `$paramName`. */
   get params(): BuildSqlParams<T["Params"]> {
      return this._paramsLazy.value;
   }

   /** Column accessors for the result row of this query, keyed as `$columnName`. Used to reference this query's output columns in a parent query. */
   get row(): SqlQueryRow<T> {
      return this._rowLazy.value;
   }

   /** @internal */
   get innerQueries(): SqlQueryAny[] {
      return this._innerQueriesLazy.value;
   }

   get dialects(): Set<string> {
      return this._dialectsLazy.value;
   }

   /** Selects all columns from this query's result — use inside `row()` when referencing this query as a subquery. */
   get $$(): SqlQueryAll<T["Row"]> {
      return this._$$Lazy.value;
   }

   /**
    * A reference to this query's output for use in a parent CTE or subquery.
    *
    * When embedded in a parent `sql` template, emits only the query name
    * (e.g. `"q1"`) rather than re-inlining the full SQL. Use this to reference
    * a CTE by name after it has already been declared in a `WITH` clause.
    */
   get out(): SqlQueryRefExtended<T> {
      return this._outLazy.value;
   }

   /** Stable SHA-256 hash of this query's template strings — used to identify the query for remote execution. */
   get hash(): Promise<string> {
      return this._hashLazy.value;
   }

   /** JSON schema describing the type structure of this query's result row — used for deserialization. */
   get jsonSchema(): SqlJsonSchema {
      return this._jsonSchemaLazy.value;
   }

   initJsonSchema(): SqlJsonSchema {
      const row = this.row as Record<string, Sql> | null;
      if (!row) return {};
      const schema: SqlJsonSchema = {};
      for (const col of Object.values(row)) {
         Object.assign(schema, col.jsonSchema);
      }
      return schema;
   }

   async initHash(): Promise<string> {
      const params = this.params as Record<string, SqlParam<{ Name: string; Type: unknown }>> | null ?? {};
      const paramNames = Object.entries(params)
         .filter(([, v]) => !v.isRuntime)
         .map(([k]) => k)
         .sort()
         .join(",");
      const runtimeNames = Object.entries(params)
         .filter(([, v]) => v.isRuntime)
         .map(([k]) => k)
         .sort()
         .join(",");
      const input =
         runtimeNames.length > 0
            ? this.hashId + "|" + paramNames + "|runtime:" + runtimeNames
            : this.hashId + "|" + paramNames;
      const encoded = new TextEncoder().encode(input);
      const buf = await crypto.subtle.digest("SHA-256", encoded);
      return Array.from(new Uint8Array(buf))
         .map((b) => b.toString(16).padStart(2, "0"))
         .join("");
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
            if (queryRef.out) {
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
                     case rawValue instanceof SqlParam && rawValue.isRuntime:
                        return `${rawString} $runtime:${rawValue.name}`;
                     case rawValue instanceof SqlParam:
                        return `${rawString} $${rawValue.name}`;
                     case rawValue instanceof Sql:
                        return `${rawString} ${rawValue.id}`;
                     default:
                        return rawValue != null ? `${rawString} ${rawValue}` : rawString;
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
               q.push(rawValue.target);
               if (rawValue.query instanceof SqlQueryRef) {
                  results.push(rawValue.query.innerQuery);
                  break;
               }

               results.push(rawValue.query);
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
                  [`$${rawValue.key}`]: newSqlQueryColumn({ target: rawValue, key: rawValue.key, query: this }),
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
            case rawValue instanceof SqlExpand:
               if (rawValue.params)
                  params = {
                     ...(params ?? {}),
                     ...(rawValue.params as Record<string, SqlParam<{ Name: string; Type: unknown }>>),
                  };
               break;
            case rawValue instanceof SqlParam && rawValue.isRuntime:
               params = { ...(params ?? {}), [rawValue.name]: rawValue };
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
    * Builds the final SQL text and parameter values array.
    *
    * The output format (placeholder style, quoting, keyword casing) is
    * determined by the plugin's tokenizer and dialect. You typically don't
    * call this directly — the plugin's `getAll` / `getOneRequired` /
    * `getOneOptional` methods call it for you.
    *
    * @param options
    * @param args - Optional params and build options.
    * @returns An object with `text` (the SQL string) and `values` (the bound values array).
    *
    * @example
    * const { text, values } = findById.getSql({ params: { id: "123" } });
    * console.log(text); // SELECT ... WHERE "account_id" = $1
    * console.log(values); // ["123"]
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
      const paramFormat = options?.paramFormat ?? getDefaultParamFormat(dialect);
      const tokens: string[] = [];
      const values = [];

      for (const token of context.tokens) {
         switch (token.type) {
            case "text":
               tokens.push(token.value);
               break;
            case "value": {
               if (!isPrimitive(token.value)) {
                  throw new SqlBuildError(
                     `Unexpected non-primitive value token — only primitives, null, Date, and Uint8Array are allowed`,
                  );
               }
               tokens.push(paramFormat({ index: values.length }));
               values.push(token.value);
               break;
            }
            case "param": {
               if (!hasParams(args)) {
                  throw new SqlBuildError(`Param value not provided for param: ${token.name}`);
               }

               const paramToken = this.params?.[token.name as keyof NonNullable<typeof this.params>] as
                  | SqlParam<{ Name: string; Type: unknown }>
                  | undefined;
               ok(paramToken, `Param token not found for token: ${token.name}`);

               const rawValue = args.params[token.name];
               const value = paramToken.valueOrDefault(rawValue) ?? null;

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
      const formatOption = options?.format ?? "auto";
      const formatter = getFormatter();
      if (formatOption === true && !formatter) {
         throw new SqlBuildError(
            `format: true was set but no formatter is registered. Call setupFormatter() from 'vexnor/format' first.`,
         );
      }

      const shouldFormat = formatOption === true || (formatOption === "auto" && formatter !== null);
      if (!shouldFormat || !formatter) {
         return { text, values };
      }

      try {
         return {
            text: formatter(text, {
               language: context.dialect,
               keywordCase: "upper",
            }),
            values,
         };
      } catch (err) {
         throw new SqlBuildError(`Failed to format SQL using dialect '${context.dialect}'.\n${text}`, { cause: err });
      }
   }

   /**
    * Tags this query with an authorization label.
    *
    * When a `QueryRegistry.registerAuthorization()` hook is registered, the hook is called
    * with this tag before the query executes. Throw inside the hook to deny
    * execution.
    *
    * @param tag - An arbitrary string label (e.g. `'admin'`, `'read:orders'`).
    */
   authorize(tag: string): this {
      const clone = Object.create(this) as this;
      clone._authorization = tag;
      return clone;
   }

   /**
    * Returns a reference to this query rendered in a specific SQL format.
    *
    * Use this to control how the query is embedded when it appears as a
    * subquery — for example, forcing it to render as a CTE (`"with"`) or
    * as an inline subquery (`"select"`, `"from"`).
    *
    * @param queryFormat - The SQL context in which to render this query.
    * @param queryType - Whether to render as a `"main"` or `"inline"` query.
    */
   render(queryFormat: SqlQueryFormat, queryType?: SqlQueryType | null): SqlQueryRefExtended<T> {
      return newSqlQueryRef(this, { queryFormat, queryType });
   }

   /**
    * Returns a reference to this query forced into inline rendering mode.
    *
    * Use this when embedding a subquery inside a function call or expression
    * where the default rendering context would produce incorrect SQL.
    *
    * @param queryFormat - Optional format override for the inline rendering.
    */
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
