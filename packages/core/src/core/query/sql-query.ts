import {
   hasParams,
   InferSelectRowByResult,
   SqlInputArgs,
   SqlQueryFormat,
   SqlQueryType,
} from "#src/core/query/sql-query-types.js";
import { ARGS, PARAMS, Sql, TYPE } from "#src/core/sql-base.js";
import { Lazy } from "#src/lib/lazy.js";
import { BuildSqlParams, SqlParam, SqlParamAny } from "#src/core/query/sql-param.js";
import { SqlQueryAll, SqlQueryRow } from "#src/core/query/sql-models.js";
import { SqlQueryInfo } from "#src/core/charms/sql-query-info.js";
import { findQueryComment } from "#src/core/utils/find-query-comment.js";
import { SqlBuildContext } from "#src/core/builder/sql-build-context.js";
import { SqlBuildOptions, sqlBuildDefaults } from "#src/core/builder/sql-build-options.js";
import { newSqlQueryRef, SqlQueryRef, SqlQueryRefAny, SqlQueryRefExtended } from "#src/core/query/sql-query-ref.js";
import { SqlBuildError } from "#src/core/sql-build-error.js";
import { Queue } from "#src/lib/queue.js";
import { SqlSelectAll } from "#src/core/query/sql-select-all.js";
import { SqlSelectValue } from "#src/core/query/sql-select-value.js";
import { newSqlQueryColumn, SqlQueryColumn } from "#src/core/query/sql-query-column.js";
import { SqlSelectRow } from "#src/core/query/sql-select-row.js";
import { SqlSelectColumn } from "#src/core/query/sql-select-column.js";
import { SqlProjectBy } from "#src/core/operators/sql-project-by.js";
import { SqlSelectCharm } from "#src/core/query/sql-charm.js";
import { getFormatter } from "#src/format/formatter-registry.js";
import { SqlTable } from "#src/core/schema/sql-table.js";
import { ok } from "#src/lib/assert.js";
import { isSqlLanguage } from "#src/core/query/lib/is-sql-language.js";
import { isPrimitive } from "#src/lib/primitive.js";
import { isContextValue } from "#src/core/query/context-value.js";
import { getDefaultParamFormat } from "#src/core/query/default-param-format.js";
import { SqlJsonSchema } from "#src/core/utils/sql-json-schema.js";
import { parseCallerLocation } from "#src/core/utils/caller-location.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SqlQueryAny = SqlQuery<any>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SqlQueryExtendedAny = SqlQueryExtended<any>;

export type SqlQueryColumns<Row> = Row extends Record<string, unknown> ? InferSelectRowByResult<Row> : unknown;

export type SqlQueryExtended<T extends { Row?: unknown; Params?: unknown }> = SqlQuery<T> & SqlQueryColumns<T["Row"]>;

// ─── .view() type inference ──────────────────────────────────────────────────

/**
 * Infers the result row type from `.view()` options:
 * - If `Columns` is provided: `Pick<Row, Columns[number]>`
 * - If `Window` is provided: adds `{ [alias]: number }` for each window entry
 * - Combined: `Pick<Row, Columns[number]> & { [alias]: number }`
 * - Neither: returns original Row
 */
export type SqlViewResultRow<
   Row,
   Columns extends readonly string[] | undefined,
   Window extends Record<string, unknown> | undefined,
> = (Columns extends readonly string[]
      ? Pick<Row & Record<string, unknown>, Columns[number]>
      : Row) &
   (Window extends Record<string, unknown>
      ? { [K in keyof Window]: number }
      : // eslint-disable-next-line @typescript-eslint/no-empty-object-type
        {});

export type SqlQueryArgs = Pick<SqlQueryAny, "rawStrings" | "rawValues"> &
   Partial<Pick<SqlQueryAny, "info" | "tag" | "label" | "location" | "locationUrl">> & {
      authorization?: string[] | null;
   };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SqlQueryBaseAny = SqlQueryBase<any>;

export interface SqlQueryBase<T extends { Row?: unknown; Params?: unknown }> {
   source: SqlQuery<T>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SqlQueryBaseExtendedAny = SqlQueryBaseExtended<any>;

export type SqlQueryBaseExtended<T extends { Row?: unknown; Params?: unknown }> = SqlQueryBase<T> &
   SqlQueryColumns<T["Row"]>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const _registeredHandlerClasses = new Set<abstract new (...args: any[]) => SqlQueryBaseAny>();

function isRegisteredHandler(value: unknown): value is SqlQueryBaseAny {
   for (const cls of _registeredHandlerClasses) {
      if (value instanceof cls) return true;
   }
   return false;
}

export function isQuery(value: unknown): value is SqlQueryBaseAny {
   if (value instanceof SqlQuery) return true;
   return isRegisteredHandler(value);
}

export function toQuery(value: unknown): SqlQueryAny | null {
   if (value instanceof SqlQuery) return value;
   if (isRegisteredHandler(value)) return value.source;
   return null;
}

export class SqlQuery<T extends { Row?: unknown; Params?: unknown }> extends Sql implements SqlQueryBase<T> {
   declare readonly [TYPE]: T["Row"];
   declare readonly [PARAMS]: T["Params"];
   declare readonly [ARGS]: T["Params"];

   readonly rawStrings: TemplateStringsArray;
   readonly rawValues: unknown[];
   readonly location: string | null;
   readonly locationUrl: string | null;
   protected _authorization: string[];

   private readonly _innerQueriesLazy = new Lazy<SqlQueryAny[]>(this.initInnerQueries.bind(this));
   private _authorizationLazy = new Lazy<string[]>(this.initAuthorization.bind(this));
   private readonly _dialectsLazy = new Lazy<Set<string>>(this.initDialects.bind(this));
   private readonly _paramsLazy = new Lazy<BuildSqlParams<T["Params"]>>(this.initParams.bind(this));
   private readonly _contextLazy = new Lazy<Partial<BuildSqlParams<T["Params"]>>>(this.initContext.bind(this));
   private readonly _rowLazy = new Lazy<SqlQueryRow<T>>(this.initRow.bind(this));
   private readonly _$$Lazy = new Lazy<SqlQueryAll<T["Row"]>>(this.initSelectAll$$.bind(this));
   private readonly _labelLazy: Lazy<string> = new Lazy(this.initLabel.bind(this));
   private readonly _infoLazy: Lazy<SqlQueryInfo | null> = new Lazy(this.initInfo.bind(this));
   private readonly _outLazy = new Lazy(this.initOut.bind(this));
   private readonly _hashLazy = new Lazy<Promise<string>>(this.initHash.bind(this));
   private readonly _jsonSchemaLazy = new Lazy<SqlJsonSchema>(this.initJsonSchema.bind(this));

   constructor(args: SqlQueryArgs) {
      super({
         type: "SqlQuery",
         id: (() => {
            const comment = findQueryComment(args.rawStrings);
            if (comment) return comment;

            const info = args.info ?? args.rawValues.find((z) => z instanceof SqlQueryInfo);
            if (!info) return "";

            return Object.entries(info.options)
               .map(([k, v]) => `${k}=${v}`)
               .join(", ");
         })(),
         hashId:
            JSON.stringify(Array.from(args.rawStrings)) +
            "|" +
            args.rawValues
               .map((v) => {
                  if (v instanceof Sql) return v.hashId;
                  if (Array.isArray(v))
                     return v.map((item) => (item instanceof Sql ? item.hashId : String(item))).join(",");
                  return String(v);
               })
               .join("|"),
         tag: args.tag,
      });

      this.rawStrings = args.rawStrings;
      this.rawValues = args.rawValues;
      if (!args.locationUrl || !args.location) {
         const { location, locationUrl } = parseCallerLocation(new Error().stack, import.meta.url);
         this.location = location;
         this.locationUrl = locationUrl;
      } else {
         this.locationUrl = args.locationUrl ?? null;
         this.location = args.location ?? null;
      }

      this._authorization = args.authorization ?? [];
   }

   // eslint-disable-next-line @typescript-eslint/no-explicit-any
   static register(cls: abstract new (...args: any[]) => SqlQueryBaseAny) {
      _registeredHandlerClasses.add(cls);
   }

   get source() {
      return this;
   }

   /** Query authorization tags — includes tags inherited from subqueries */
   get authorization(): string[] {
      return this._authorizationLazy.value;
   }

   /** Query info */
   get info(): SqlQueryInfo | null {
      return this._infoLazy.value;
   }

   /** Query label */
   get label(): string {
      return this._labelLazy.value;
   }

   /** Named parameter accessors for this query, keyed as `$paramName`. */
   get params(): BuildSqlParams<T["Params"]> {
      return this._paramsLazy.value;
   }

   /** Named parameter accessors for this query, keyed as `$paramName`. */
   get context(): Partial<BuildSqlParams<T["Params"]>> {
      return this._contextLazy.value;
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
      const params = (this.params as Record<string, SqlParam<{ Name: string; Type: unknown }>> | null) ?? {};
      const paramNames = Object.entries(params)
         .filter(([, v]) => !v.isContext)
         .map(([k]) => k)
         .sort()
         .join(",");
      const contextNames = Object.entries(params)
         .filter(([, v]) => v.isContext)
         .map(([k]) => k)
         .sort()
         .join(",");
      const input =
         contextNames.length > 0
            ? this.hashId + "|" + paramNames + "|context:" + contextNames
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
         case token instanceof SqlQueryRef:
            this.buildInnerQueryRef(token, context, options);
            break;
         case token instanceof Sql && isQuery(token):
            this.buildInnerQueryRef(token.source, context, options);
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
            if (options?.boundaryComments ?? sqlBuildDefaults.boundaryComments)
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

               // Look-ahead: the literal template text that immediately follows
               // this interpolation — from the next character until the next
               // interpolation (or end of template). Formatters inspect this to
               // detect expression operators like ::, ||, or ) and suppress alias.
               context.nextText =
                  i + 1 < this.rawStrings.length ? (this.rawStrings[i + 1] ?? null) : null;

               // Look-behind: the literal template text that precedes this
               // interpolation. Formatters inspect trailing operators (||, ::)
               // to detect that this column is inside an expression.
               context.prevText = rawString ?? null;

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

               context.nextText = null;
               context.prevText = null;
            }

            if (options?.boundaryComments ?? sqlBuildDefaults.boundaryComments)
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
                     case isQuery(rawValue):
                        return `${rawString} (${rawValue.source.label})`;
                     case rawValue instanceof SqlQueryRef:
                        return `${rawString} (${rawValue.innerQuery.label})`;
                     case rawValue instanceof SqlParam && rawValue.isContext:
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

   initAuthorization(authorization = this._authorization): string[] {
      const tags = new Set<string>(authorization);
      for (const inner of this.innerQueries) {
         for (const tag of inner._authorization) {
            tags.add(tag);
         }
      }
      return [...tags];
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
            case isQuery(rawValue):
               for (const d of rawValue.source.dialects) result.add(d);
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
            case isQuery(rawValue): {
               const src = rawValue.source;
               results.push(src);
               results.push(...src.innerQueries);
               break;
            }
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
            case rawValue instanceof SqlProjectBy:
               // Projection contributes all table columns as the row shape
               for (const [key, col] of Object.entries(rawValue.table.cols)) {
                  row = {
                     ...(row ?? {}),
                     [key]: newSqlQueryColumn({ target: col, key: key.slice(1), query: this }),
                  };
               }
               break;
         }
      }

      return row as SqlQueryRow<T>;
   }

   initParams(rawValues = this.rawValues): BuildSqlParams<T["Params"]> {
      let params: Partial<BuildSqlParams<T["Params"]>> = {};
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

   initContext(params = this.params): Partial<BuildSqlParams<T["Params"]>> {
      if (!params || typeof params !== "object") return null as BuildSqlParams<T["Params"]>;

      return Object.fromEntries(
         // eslint-disable-next-line unused-imports/no-unused-vars
         Object.entries(params).filter(([_k, v]: [string, SqlParamAny]) => v.isContext),
      ) as BuildSqlParams<T["Params"]>;
   }

   initOut(): SqlQueryRefExtended<T> {
      return newSqlQueryRef(this, null, true);
   }

   /**
    * Collect AI documentation from all operator tokens in this query.
    * Uses a FIFO queue to iterate tokens without recursion.
    */
   getAiPrompt(): string {
      const prompts: string[] = [];
      const seen = new Set<string>();
      const queue = new Queue<unknown>(this.rawValues);
      for (const { item } of queue.each()) {
         if (item instanceof Sql) {
            const prompt = item.aiPrompt;
            if (prompt && !seen.has(prompt)) {
               seen.add(prompt);
               prompts.push(prompt);
            }
            if ("rawValues" in item) queue.push(...(item as SqlQuery<never>).rawValues);
            if ("innerQuery" in item) queue.push(...(item as { innerQuery: SqlQuery<never> }).innerQuery.rawValues);
         }
      }
      return prompts.join("\n");
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

               const sqlParam = this.params?.[token.name as keyof NonNullable<typeof this.params>] as
                  | SqlParam<{ Name: string; Type: unknown }>
                  | undefined;
               ok(sqlParam, `Param token not found for token: ${token.name}`);

               const rawValue = args.params[token.name];
               const value = isContextValue(rawValue) ? null : (sqlParam.resolve(args.params as Record<string, unknown>) ?? null);

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
            `format: true was set but no formatter is registered. Call setupFormatter() from '@vexnor/core/format' first.`,
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
    * @param tags authorization tags
    */
   authorize(...tags: string[]): this {
      const clone = Object.create(this) as this;
      clone._authorization = [...this._authorization, ...tags];
      clone._authorizationLazy = new Lazy(() => clone.initAuthorization());
      return clone;
   }

   /**
    * Creates a view projection of this query using build-time interception.
    *
    * Unlike subquery wrapping, this approach modifies the query's build output
    * directly — trimming `row()` columns, removing `col()` expressions, and
    * appending window functions to the SELECT clause. CTEs, WHERE, FROM, JOINs,
    * and ORDER BY pass through unchanged.
    *
    * Type inference:
    * - `columns` narrows the result to `Pick<Row, columns[number]>`
    * - `window` adds typed window function aliases (number for aggregates/ranking)
    * - Combined: `Pick<Row, columns[number]> & { [alias]: number }`
    *
    * @example
    * ```typescript
    * const ranked = myQuery.view({
    *   columns: ["accountId", "email"],
    *   window: { rank: { fn: "row_number", over: { orderBy: { createdAt: "DESC" } } } }
    * });
    * // Result type: { accountId: string; email: string; rank: number }
    * ```
    */
   view<
      Columns extends readonly (keyof T["Row"] & string)[] | undefined = undefined,
      Window extends Record<string, { fn: string; col?: string; args?: unknown; over: Record<string, unknown> }> | undefined = undefined,
   >(options: {
      columns?: Columns;
      window?: Window;
   }): SqlQueryExtended<{
      Row: SqlViewResultRow<T["Row"], Columns, Window>;
      Params: T["Params"];
   }> {
      const columns = options.columns as string[] | undefined;
      const window = (options.window ?? {}) as Record<string, unknown>;

      // Build window expression strings
      const windowExprs: string[] = [];
      for (const [alias, entry] of Object.entries(window)) {
         if (entry instanceof SqlQuery) {
            windowExprs.push(`__SQL_QUERY__:${alias}`);
         } else if (entry && typeof entry === "object" && "fn" in entry) {
            windowExprs.push(`${buildWindowExpr(entry as { fn: string; col?: string; args?: number; over: Record<string, unknown> })} as "${alias}"`);
         }
      }

      // Create a view query that shares the same template but intercepts during build
      const viewQuery = new SqlViewQuery<{ Row: SqlViewResultRow<T["Row"], Columns, Window>; Params: T["Params"] }>({
         rawStrings: this.rawStrings,
         rawValues: this.rawValues,
         location: this.location,
         locationUrl: this.locationUrl,
         authorization: this._authorization.length > 0 ? this._authorization : null,
      }, {
         columns: columns ? new Set(columns) : undefined,
         windowExprs,
         windowEntries: window as Record<string, unknown>,
         source: this,
      });
      return newSqlQuery(viewQuery as any) as unknown as SqlQueryExtended<{ Row: SqlViewResultRow<T["Row"], Columns, Window>; Params: T["Params"] }>;
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

   /**
    * Getter method to retrieve the type of the row.
    *
    * @return T["Row"] The type definition for the row.
    */
   get rowType(): T["Row"] {
      throw new Error("this property is only for fetching the row type");
   }

   /**
    * Retrieves the filtered context from the given arguments based on the parameters.
    *
    * @param args - The input arguments used to determine the relevant context.
    * @return {Record<string, unknown>} A record containing filtered key-value pairs from the arguments that match the context parameters.
    */
   getContext(args: T["Params"]): Record<string, unknown> {
      ok(typeof this.params === "object" && this.params !== null, `Cannot get context for query with no parameters`);
      ok(args, `Cannot get context for query with no arguments`);
      // eslint-disable-next-line unused-imports/no-unused-vars
      const ctx = new Map(Object.entries(this.params).filter(([_k, v]: [string, SqlParamAny]) => v.isContext));

      return Object.fromEntries(Object.entries(args).filter(([key]) => ctx.has(key)));
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

// ─── .view() helpers ─────────────────────────────────────────────────────────

/**
 * Builds a window function SQL expression from a structured entry.
 * Uses unqualified column names since .view() uses build-time interception (no subquery wrapping).
 */
function buildWindowExpr(entry: { fn: string; col?: string; args?: number; over: Record<string, unknown> }): string {
   const { fn, col, args, over } = entry;
   let call: string;

   const RANKING = new Set(["row_number", "rank", "dense_rank", "percent_rank", "cume_dist"]);
   const AGGREGATE = new Set(["sum", "avg", "count", "min", "max", "first_value", "last_value"]);
   const OFFSET = new Set(["lag", "lead"]);

   if (RANKING.has(fn)) {
      call = `${fn}()`;
   } else if (fn === "ntile") {
      call = `ntile(${args ?? 4})`;
   } else if (AGGREGATE.has(fn)) {
      call = col === "*" ? `${fn}(*)` : `${fn}("${col}")`;
   } else if (OFFSET.has(fn)) {
      call = `${fn}("${col}", ${args ?? 1})`;
   } else {
      call = `${fn}()`;
   }

   const overParts: string[] = [];
   const partitionBy = over.partitionBy as string[] | undefined;
   const orderBy = over.orderBy as Record<string, string> | undefined;
   const frame = over.frame as string | undefined;
   const start = over.start as string | number | undefined;
   const end = over.end as string | number | undefined;

   if (partitionBy && partitionBy.length > 0) {
      overParts.push(`PARTITION BY ${partitionBy.map((c) => `"${c}"`).join(", ")}`);
   }
   if (orderBy && Object.keys(orderBy).length > 0) {
      overParts.push(`ORDER BY ${Object.entries(orderBy).map(([c, d]) => `"${c}" ${d.toUpperCase()}`).join(", ")}`);
   }
   if (frame && (start !== undefined || end !== undefined)) {
      const s = formatFrameBound(start ?? "unbounded preceding", "start");
      const e = formatFrameBound(end ?? "unbounded following", "end");
      overParts.push(`${frame.toUpperCase()} BETWEEN ${s} AND ${e}`);
   }

   return `${call} OVER (${overParts.join(" ")})`;
}

function formatFrameBound(bound: string | number, position: "start" | "end"): string {
   if (typeof bound === "string") return bound;
   if (bound === 0) return "current row";
   return position === "start" ? `${bound} preceding` : `${bound} following`;
}

// ─── SqlViewQuery — build-time interception for .view() ──────────────────────

export type SqlViewQueryOptions = {
   /** Column keys to include in the output. undefined = keep all. */
   columns?: Set<string>;
   /** Pre-built window expression SQL strings to append after SELECT columns. */
   windowExprs: string[];
   /** Raw window entries (for SqlQuery-based expressions). */
   windowEntries: Record<string, unknown>;
   /** Reference to the source query (for type inference). */
   source: SqlQueryAny;
};

/**
 * A SqlQuery subclass that intercepts the build loop to implement .view() semantics:
 * - Filters row() columns via context.viewFilter
 * - Removes col() nodes (and their preceding SQL expressions) not in the columns list
 * - Appends window function expressions after the last SELECT column
 *
 * CTEs, WHERE, FROM, JOINs, ORDER BY pass through unchanged.
 */
export class SqlViewQuery<T extends { Row?: unknown; Params?: unknown }> extends SqlQuery<T> {
   readonly _viewOptions: SqlViewQueryOptions;

   constructor(args: SqlQueryArgs, viewOptions: SqlViewQueryOptions) {
      super(args);
      this._viewOptions = viewOptions;
   }

   write(
      context: SqlBuildContext,
      options: SqlBuildOptions | null = null,
      scope?: unknown,
   ) {
      context.scope(
         this,
         () => {
            const queryName = context.getQueryName(this);
            if (options?.boundaryComments ?? sqlBuildDefaults.boundaryComments)
               context.addStrings(` /* <${queryName}> */ `);

            // Set view filter on context so row()/SqlTableAll respect it
            const prevViewFilter = context.viewFilter;
            if (this._viewOptions.columns) {
               context.viewFilter = {
                  columns: this._viewOptions.columns,
                  windowExprs: this._viewOptions.windowExprs,
               };
            } else if (this._viewOptions.windowExprs.length > 0) {
               context.viewFilter = {
                  windowExprs: this._viewOptions.windowExprs,
               };
            }

            const children = [...this.rawValues];
            let i = -1;
            let inSelect = false;
            let windowInjected = false;
            let trimLeadingComma = false; // Set when col() was first expression (no preceding comma)

            while (children.length || i < this.rawStrings.length) {
               i++;
               let rawString = i < this.rawStrings.length ? this.rawStrings[i] : undefined;
               if (rawString) {
                  // If previous col() removal left no preceding comma, trim leading comma from this string
                  if (trimLeadingComma) {
                     rawString = rawString.replace(/^\s*,\s*/, "");
                     trimLeadingComma = false;
                  }

                  // Check if we're entering or leaving the SELECT clause
                  const upperRaw = rawString.toUpperCase().trim();
                  if (upperRaw.startsWith("SELECT") || upperRaw === "" && inSelect) {
                     inSelect = true;
                  }
                  // Detect transition out of SELECT (FROM, WHERE, etc.)
                  if (inSelect && /\bFROM\b/i.test(rawString)) {
                     // Before emitting FROM, inject window expressions
                     if (!windowInjected && this._viewOptions.windowExprs.length > 0) {
                        for (const wexpr of this._viewOptions.windowExprs) {
                           if (wexpr.startsWith("__SQL_QUERY__:")) {
                              // Handle raw SqlQuery window expression
                              const alias = wexpr.slice("__SQL_QUERY__:".length);
                              const sqlExpr = this._viewOptions.windowEntries[alias] as SqlQueryAny;
                              context.addStrings(", ");
                              sqlExpr.build(context, options, { queryType: "inline" });
                              context.addStrings(` as "${alias}"`);
                           } else {
                              context.addStrings(`, ${wexpr}`);
                           }
                        }
                        windowInjected = true;
                     }
                     inSelect = false;
                  }

                  // Check if the next child is a col() that should be removed
                  if (children.length > 0 && this._viewOptions.columns) {
                     const nextChild = children[0] as { type?: string; key?: string };
                     if (nextChild?.type === "SqlSelectColumn" && nextChild.key && !this._viewOptions.columns.has(nextChild.key)) {
                        // This col() should be removed. Trim the preceding SQL expression.
                        // The rawString before a col() typically contains something like:
                        //   ", count(*) as " (has comma) → trim from last comma
                        //   "SELECT count(*) as " (no comma) → emit everything before the expression, trim leading comma from next string
                        const lastComma = rawString.lastIndexOf(",");
                        if (lastComma >= 0) {
                           // Trim everything from the last comma onward
                           const trimmed = rawString.slice(0, lastComma);
                           if (trimmed) {
                              context.addStrings(trimmed);
                              context.next(trimmed);
                           }
                        } else {
                           // No comma found — this col is the first expression.
                           // Don't emit the rawString (it contains the expression for the col).
                           // Instead, extract just the keyword part (e.g., "SELECT ") and trim leading comma from next string.
                           const selectMatch = rawString.match(/^(\s*(?:SELECT)\s+)/i);
                           if (selectMatch) {
                              // Emit just the SELECT keyword
                              context.addStrings(selectMatch[1]!);
                              context.next(selectMatch[1]!);
                           }
                           // The next rawString will start with ", " which needs trimming
                           trimLeadingComma = true;
                        }
                        // Skip the col() child
                        children.shift();
                        continue;
                     }
                  }

                  if (rawString) {
                     context.addStrings(rawString);
                     context.next(rawString);
                  }
               }

               if (!children.length) break;

               const child = children.shift();

               context.nextText =
                  i + 1 < this.rawStrings.length ? (this.rawStrings[i + 1] ?? null) : null;
               context.prevText = rawString ?? null;

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

               context.nextText = null;
               context.prevText = null;
            }

            // If window expressions haven't been injected yet (no FROM found), inject at the end
            if (!windowInjected && this._viewOptions.windowExprs.length > 0) {
               for (const wexpr of this._viewOptions.windowExprs) {
                  if (wexpr.startsWith("__SQL_QUERY__:")) {
                     const alias = wexpr.slice("__SQL_QUERY__:".length);
                     const sqlExpr = this._viewOptions.windowEntries[alias] as SqlQueryAny;
                     context.addStrings(", ");
                     sqlExpr.build(context, options, { queryType: "inline" });
                     context.addStrings(` as "${alias}"`);
                  } else {
                     context.addStrings(`, ${wexpr}`);
                  }
               }
            }

            // Restore previous view filter
            context.viewFilter = prevViewFilter;

            if (options?.boundaryComments ?? sqlBuildDefaults.boundaryComments)
               context.addStrings(`/* </${queryName}> */`);
         },
         scope ?? { queryType: "main", cte: false },
      );
   }

}
