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
import { Queue } from "../../lib/index.js";
import { format } from "sql-formatter";
import { SqlLanguage } from "sql-formatter";
import { SqlBuildOptions } from "./sql-query-types.js";
import { SqlBuildToken } from "./sql-models.js";

export interface SqlBuildContextArgs extends SqlBuildOptions {
   query?: SqlQueryAny;
}

export class SqlBuildContext {
   readonly tokenizer: ITokenizer;
   readonly formatter: DefaultFormatter;
   readonly dialect: SqlLanguage;

   private readonly _tokens: SqlBuildToken[] = [];
   private readonly _keywordStacks: string[][] = [[]];
   private readonly _contextParentDepths: number[] = [0];
   private _parentDepth: number = 0;
   private readonly _tableAliasById = new Map<string, string>();
   readonly queries = new Map<string, { index: number; query: SqlQueryAny; cte: boolean }>();
   private _queryStack: SqlQueryAny[] = [];
   private _text: string | null = null;

   constructor(args?: SqlBuildContextArgs) {
      if (args?.query) {
         this.scope({ query: args.query });
      }

      this.tokenizer = args?.tokenizer ?? new DefaultTokenizer();
      this.formatter = args?.formatter ?? new DefaultFormatter();
      this.dialect = args?.dialect ?? "sql";
   }

   get tokens(): ReadonlyArray<SqlBuildToken> {
      return Object.freeze(this._tokens);
   }

   get values(): ReadonlyArray<unknown> {
      return this.tokens.filter((z) => z.type === "value").map((z) => z.value);
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
      if (this._text) {
         return this._text;
      }

      let text = "";
      for (const token of this._tokens) {
         switch (token.type) {
            case "text":
               text += token.value;
               break;
            case "param":
               text += "?";
               break;
            case "value":
               if (Array.isArray(token.value)) {
                  text += Array(token.value.length).fill("?").join(", ");
                  break;
               }

               text += "?";
               break;
            default:
               throw new SqlBuildError(`Unknown token type ${typeof token}: ${token}`);
         }
      }

      try {
         return format(text, {
            language: this.dialect,
            keywordCase: "upper",
         });
      } catch (err) {
         console.error("Failed to format:", text);
         throw err;
      }
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

   private getAliasId(tableInfo: { schema?: string; name: string; alias?: string }) {
      return (
         (this._queryStack.at(-1)?.ID ?? "") +
         "/" +
         (tableInfo.schema ? `${tableInfo.schema}.${tableInfo.name}` : tableInfo.name)
      );
   }

   setAlias(tableInfo: { schema?: string; name: string; alias?: string }) {
      if (!tableInfo.alias) return;

      const id = this.getAliasId(tableInfo);
      this._tableAliasById.set(id, tableInfo.alias);
   }

   /**
    * Gets the alias for the respective tableInfo.
    * @param tableInfo
    */
   alias(tableInfo: { schema?: string; name: string; alias?: string }) {
      if (tableInfo.alias) return tableInfo.alias;

      const id = this.getAliasId(tableInfo);
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
      for (const { query } of this.queries.values()) {
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
            buildTokens: this.tokens,
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
      const query = sql instanceof SqlQuery ? sql : this.getQuery(sql);
      if (query.info?.label) {
         return query.info.label;
      }

      const index = this.queries.get(query.ID)?.index ?? null;
      if (index === null) {
         throw new SqlBuildError(`Query not tracked for: ${sql}`);
      }

      return `query_${index}`;
   }

   /**
    * Adds strings unquoted
    * @param strings
    */
   addStrings(...strings: string[]) {
      ok(strings[0], `strings is required`);
      const tokens: SqlBuildToken[] = strings.map((value) => {
         return { type: "text", value };
      });
      this._tokens.push(...tokens);
   }

   /**
    * Adds quoted strings
    * @param quotes
    */
   addQuotes(...quotes: string[]) {
      ok(quotes[0], `quotes is required`);
      const tokens: SqlBuildToken[] = quotes.map((value) => {
         return { type: "text", value: quote(value) };
      });
      this._tokens.push(...tokens);
   }

   /**
    * Adds values
    * @param values
    */
   addValues(...values: unknown[]) {
      for (const value of values) {
         this._tokens.push({ type: "value", value: value ?? null });
      }
   }

   /**
    * Adds a named parameter
    * @param param
    */
   addParam(param: { name: string }) {
      this._tokens.push({
         type: "param",
         name: param.name,
      });
   }

   /**
    * Stacks the current context with the query.
    * @param args
    * @param callback
    */
   scope<Result = undefined>(
      args: { query: SqlQueryAny; cte?: boolean },
      callback?: () => Result,
   ): typeof callback extends undefined ? void : Result {
      this._keywordStacks.push([]);
      this._queryStack.push(args.query);

      if (!this.queries.has(args.query.ID)) {
         const queue = new Queue(args.query);
         for (const query of queue.shift()) {
            this.queries.set(query.ID, { index: this.queries.size, query, cte: false });
            queue.add(...query.rawValues.filter((z) => z instanceof SqlQuery));
         }
      }

      if (args.cte) {
         // Update CTE flag if query is already registered
         const existing = this.queries.get(args.query.ID)!;
         this.queries.set(args.query.ID, { ...existing, cte: true });
      }

      if (callback) {
         try {
            const result = callback();
            return result;
         } catch (err) {
            console.error(err);
            throw err;
         } finally {
            this._queryStack.pop();
            this._keywordStacks.pop();
         }
      }

      return undefined as Result;
   }

   /**
    * Checks if a query is a declared CTE
    * @param query
    */
   isCTE(query: SqlQueryAny): boolean {
      return this.queries.get(query.ID)?.cte ?? false;
   }
}
