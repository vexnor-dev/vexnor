import { ITokenizer } from "../sql-tokenizer.js";
import { MAJOR_KEYWORDS, SUBQUERY_STARTERS } from "../sql-constants.js";
import { DefaultFormatter } from "../default-formatter.js";
import { IBuildQueryContext } from "../sql-types.js";
import { DefaultTokenizer } from "../default-tokenizer.js";
import { quote, trim } from "../utils/index.js";
import { ok } from "assert";
import { Sql } from "../sql-base.js";
import { SqlQueryAny } from "./sql-query.js";
import { SqlBuildError } from "../sql-build-error.js";
import { SqlSelectRow } from "./sql-select-row.js";

export type SqlBuildContextArgs = {
   tokenizer?: ITokenizer;
   formatter?: DefaultFormatter;
   query?: SqlQueryAny;
};

export class SqlBuildContext implements IBuildQueryContext {
   readonly tokenizer: ITokenizer;
   readonly formatter: DefaultFormatter;
   readonly queryIndex: number = 0;
   readonly queriesBySqlId: Map<string, SqlQueryAny>;
   readonly queryNamesByQuery = new Map<SqlQueryAny, string>();

   private readonly _strings: string[] = [];
   private readonly _values: unknown[] = [];
   private readonly _keywordStacks: string[][] = [[]];
   private readonly _contextParentDepths: number[] = [0];
   private _parentDepth: number = 0;
   private readonly _tableAliasById = new Map<string, string>();

   constructor(args?: SqlBuildContextArgs) {
      this.queriesBySqlId = args?.query?.queriesBySqlId ?? new Map<string, SqlQueryAny>();
      if (args?.query) {
         this.addQuery(args.query);
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

   queryName(sql: Sql) {
      const query = this.queriesBySqlId.get(sql.ID);
      if (!query) throw new SqlBuildError(`Query not found for sql: ${sql}`);
      const result = this.queryNamesByQuery.get(query);

      if (!result) throw new SqlBuildError(`Query name not found for query: ${query}`);
      return result;
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

   addQuery(query: SqlQueryAny) {
      this.queriesBySqlId.set(query.ID, query);
      if (query.ROW) this.queriesBySqlId.set(query.ROW.ID, query);
      for (const select of query.rawValues) {
         if (!(select instanceof SqlSelectRow)) continue;

         this.queriesBySqlId.set(select.ID, query);
      }

      this.queryNamesByQuery.set(query, query?.info?.label ?? `query_${this.queryIndex}`);
   }

   scope({ query }: { query: SqlQueryAny }): SqlBuildContext {
      const queryIndex = this.queryIndex + 1;
      this.queryNamesByQuery.set(query, query?.info?.label ?? `query_${queryIndex}`);
      return this;
   }

   /**
    * Adds strings unquoted
    * @param strings
    */
   addStrings(...strings: string[]) {
      ok(strings[0], `strings is required`);
      this._strings.push(...strings);
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
      ok(values[0], `value is required`);
      this._values.push(...values);
   }
}
