import { ITokenizer } from "../sql-tokenizer.js";
import { MAJOR_KEYWORDS, SUBQUERY_STARTERS } from "../sql-constants.js";
import { DefaultFormatter } from "../default-formatter.js";
import { DefaultTokenizer } from "../default-tokenizer.js";
import { quote, trim } from "../utils/index.js";
import { ok } from "assert";
import { Sql } from "../sql-base.js";
import { SqlQuery, SqlQueryAny } from "./sql-query.js";
import { SqlSelectAll } from "./sql-select-all.js";
import { SqlSelectColumn } from "./sql-select-column.js";
import { SqlSelectRow } from "./sql-select-row.js";
import { SqlBuildError } from "../sql-build-error.js";
import { SqlBuildOptions } from "./sql-query-types.js";

export type SqlBuildContextArgs = {
   tokenizer?: ITokenizer;
   formatter?: DefaultFormatter;
   query?: SqlQueryAny;
};

export class SqlBuildContext {
   readonly tokenizer: ITokenizer;
   readonly formatter: DefaultFormatter;

   private readonly _strings: string[] = [];
   private readonly _values: unknown[] = [];
   private readonly _keywordStacks: string[][] = [[]];
   private readonly _contextParentDepths: number[] = [0];
   private _parentDepth: number = 0;
   private readonly _tableAliasById = new Map<string, string>();
   readonly queries: SqlQueryAny[] = [];

   constructor(args?: SqlBuildContextArgs) {
      if (args?.query) {
         this.trackQuery(args.query);
      }

      this.tokenizer = args?.tokenizer ?? new DefaultTokenizer();
      this.formatter = args?.formatter ?? new DefaultFormatter();
   }

   get strings(): ReadonlyArray<string> {
      return Object.freeze(this._strings);
   }

   get values(): ReadonlyArray<unknown> {
      return Object.freeze(this._values);
   }

   /**
    * The current keyword
    */
   get keyword(): string | undefined {
      const stack = this.currentStack;
      for (let i = stack.length - 1; i >= 0; i--) {
         const keyword = stack[i]!;
         if (MAJOR_KEYWORDS.includes(keyword)) {
            return keyword;
         }
      }
      return undefined;
   }

   get text() {
      return this._strings.join("");
   }

   private get currentStack(): string[] {
      return this._keywordStacks[this._keywordStacks.length - 1]!;
   }

   /**
    * The current keyword
    */
   *keywords(): IterableIterator<string> {
      const stack = this.currentStack;
      for (let i = stack.length - 1; i >= 0; i--) {
         const keyword = stack[i]!;
         if (MAJOR_KEYWORDS.includes(keyword)) {
            yield keyword;
         }
      }
   }

   setAlias(tableInfo: { schema?: string; name: string; alias?: string }) {
      if (!tableInfo.alias) return;

      const id = tableInfo.schema ? `${tableInfo.schema}.${tableInfo.name}` : tableInfo.name;
      this._tableAliasById.set(id, tableInfo.alias);
   }

   /**
    * Gets the alias for the respective tableInfo.
    * @param tableInfo
    */
   alias(tableInfo: { schema?: string; name: string; alias?: string }) {
      if (tableInfo.alias) return tableInfo.alias;

      const id = tableInfo.schema ? `${tableInfo.schema}.${tableInfo.name}` : tableInfo.name;
      if (!this._tableAliasById.has(id)) {
         const token = tableInfo.name
            .split("_")
            .map((z) => z[0])
            .join("");
         this._tableAliasById.set(id, `${token}_${this._tableAliasById.size + 1}`);
      }

      return this._tableAliasById.get(id)!;
   }

   next(text: string) {
      const tokens = this.tokenizer.tokenize(trim(text));

      for (let i = 0; i < tokens.length; i++) {
         const token = tokens[i]!;
         if (token === "(") {
            const prevToken =
               this.currentStack.length > 0 ? this.currentStack[this.currentStack.length - 1] : undefined;

            if (prevToken === "over") {
               this.currentStack.pop(); // consume 'over'
               this._contextParentDepths.push(this._parentDepth);
               this._keywordStacks.push(["over"]);
            } else if (prevToken && SUBQUERY_STARTERS.includes(prevToken)) {
               this._contextParentDepths.push(this._parentDepth);
               this._keywordStacks.push([prevToken]);
            } else if (prevToken && /^[a-z_]/.test(prevToken) && !MAJOR_KEYWORDS.includes(prevToken)) {
               this.currentStack.pop(); // It's a function call, consume the name
               this._contextParentDepths.push(this._parentDepth);
               this._keywordStacks.push(["fn"]);
            } else {
               const nextMeaningfulToken = tokens.slice(i + 1).find((t) => t.trim());
               if (nextMeaningfulToken === "select") {
                  this._contextParentDepths.push(this._parentDepth);
                  this._keywordStacks.push([]);
               }
            }
            this._parentDepth++;
         } else if (token === ")") {
            this._parentDepth--;
            if (
               this._keywordStacks.length > 1 &&
               this._parentDepth === this._contextParentDepths[this._contextParentDepths.length - 1]!
            ) {
               this._keywordStacks.pop();
               this._contextParentDepths.pop();
            }
         } else {
            this.currentStack.push(token);
         }
      }
   }

   isRowToken(sql: Sql) {
      switch (true) {
         case sql instanceof SqlSelectRow:
         case sql instanceof SqlSelectColumn:
         case sql instanceof SqlSelectAll:
         case sql instanceof SqlQuery:
            return true;
      }

      return false;
   }

   *rowTokens(): IterableIterator<{
      query: SqlQueryAny;
      sql: Sql;
   }> {
      for (const query of this.queries) {
         yield { query, sql: query };

         if (query.$$) {
            yield { query, sql: query.$$ };
         }

         if (query.row) {
            for (const sql of Object.values(query.row)) {
               yield { query, sql };
            }
         }
      }
   }

   /**
    * Gets the query for the respective sql
    * @param sql
    */
   getQuery(sql: Sql): SqlQueryAny {
      if (!this.isRowToken(sql)) {
         throw new SqlBuildError(`Query not tracked for: ${sql}`);
      }

      for (const token of this.rowTokens()) {
         if (token.sql === sql) {
            return token.query;
         }
      }

      throw new SqlBuildError(
         `Query not found for ${sql}. If this is a subquery, it needs to be tracked into the build context`,
         {
            strings: this.strings,
            data: {
               values: this.values,
            },
         },
      );
   }

   /**
    * Gets the query name for the respective sql
    * @param sql
    */
   getQueryName(sql: Sql) {
      const query = this.getQuery(sql);
      return query?.info?.label ?? `query_${this.queries.indexOf(query)}`;
   }

   /**
    * Adds strings unquoted
    * @param strings
    */
   addStrings(...strings: string[]) {
      ok(strings[0], `strings is required`);
      try {
         this._strings.push(...strings);
      } catch (err) {
         throw new SqlBuildError(`Failed to add strings: ${strings}`, { cause: err });
      }
   }

   /**
    * Adds quoted strings
    * @param quotes
    */
   addQuotes(...quotes: string[]) {
      ok(quotes[0], `quotes is required`);
      this._strings.push(...quotes.map((s) => quote(s)));
   }

   /**
    * Adds values
    * @param values
    */
   addValues(...values: unknown[]) {
      this._values.push(
         ...values.map((value) => {
            switch (value) {
               case null:
               case undefined:
                  return null;
               default:
                  return value;
            }
         }),
      );
   }

   /**
    * Tracks the query into the current build context
    * @param query
    */
   trackQuery(query: SqlQueryAny): SqlBuildContext {
      if (this.queries.includes(query)) return this;

      const queue = [query];
      while (queue.length) {
         const query = queue.shift()!;

         if (this.queries.includes(query)) continue;

         this.queries.push(query);
         queue.push(query);
         queue.push(...query.rawValues.filter((z) => z instanceof SqlQuery));
      }

      return this;
   }

   addQuery(sql: SqlQueryAny, options?: SqlBuildOptions) {
      this.trackQuery(sql);
      sql.build(this, options);
   }
}
