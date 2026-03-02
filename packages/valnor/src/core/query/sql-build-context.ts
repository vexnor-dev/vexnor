import { ITokenizer } from "../sql-tokenizer.js";
import { MAJOR_KEYWORDS, SUBQUERY_STARTERS } from "../sql-constants.js";
import { DefaultFormatter } from "../default-formatter.js";
import { DefaultTokenizer } from "../default-tokenizer.js";
import { quote, trim } from "../utils/index.js";
import { ok } from "assert";
import { SqlQuery, SqlQueryAny } from "./sql-query.js";
import { SqlBuildError } from "../sql-build-error.js";
import { Queue } from "../../lib/index.js";
import { format, SqlLanguage } from "sql-formatter";
import { SqlBuildOptions } from "./sql-query-types.js";
import { SqlBuildToken } from "./sql-models.js";
import { SqlQueryColumn, SqlQueryColumnAny } from "./sql-query-column.js";
import { SqlSelectAll, SqlSelectAllAny } from "./sql-select-all.js";
import { SqlExpandHandlerAny } from "./sql-expand.js";

export type SqlBuildContextArgs = SqlBuildOptions & Partial<Pick<SqlBuildContext, "query" | "params">>;

type QueryInfo = { index: number; query: SqlQueryAny; cte: boolean; name: string };

export class SqlBuildContext {
   readonly tokenizer: ITokenizer;
   readonly formatter: DefaultFormatter;
   readonly dialect: SqlLanguage;
   readonly queries = new Map<string, QueryInfo>();
   readonly params: Record<string, unknown> | null;

   private readonly _tokens: SqlBuildToken[];
   private readonly _keywordStacks: string[][];
   private readonly _contextParentDepths: number[];
   private _parentDepth: number = 0;
   private readonly _tableAliasById = new Map<string, string>();
   private _queryStack: SqlQueryAny[];

   constructor(args?: SqlBuildContextArgs) {
      this.tokenizer = args?.tokenizer ?? new DefaultTokenizer();
      this.formatter = args?.formatter ?? new DefaultFormatter();
      this.dialect = args?.dialect ?? "sqlite";
      this.params = args?.params ?? null;

      this._tokens = [];
      this._keywordStacks = [[]];
      this._contextParentDepths = [0];
      this._queryStack = [];
      this._text = null;

      if (args?.query) {
         this.scope({ query: args.query });
      }
   }

   private _text: string | null;

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
            case "expand":
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
         return format(text + "\n", {
            language: this.dialect,
            keywordCase: "upper",
         });
      } catch (err) {
         console.error("Failed to format:\n", text);
         throw err;
      }
   }

   get tokens(): ReadonlyArray<SqlBuildToken> {
      return Object.freeze([...this._tokens]);
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

   getAliasId({ schema, name, position = -1 }: { schema?: string; name: string; position?: number }) {
      return `${this._queryStack.at(position)?.id ?? "-"}/` + `${schema ? `${schema}.${name}` : name}`;
   }

   *getAliasIds(tableInfo: { schema?: string; name: string }): IterableIterator<string> {
      for (let i = 0; i <= this._queryStack.length; i++) {
         yield this.getAliasId({ ...tableInfo, position: i });
      }
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
   alias(tableInfo: { schema?: string; name: string; alias?: string; out?: boolean }) {
      if (tableInfo.alias) return tableInfo.alias;

      if (tableInfo.out) {
         const ids = Array.from(this.getAliasIds(tableInfo));
         for (const id of ids) {
            if (this._tableAliasById.has(id)) return this._tableAliasById.get(id)!;
         }
      }

      const id = this.getAliasId(tableInfo);
      let result = this._tableAliasById.get(id);
      if (result) return result;

      const token = tableInfo.name
         .split("_")
         .map((z) => z[0])
         .join("");
      result = `${token}_${this._tableAliasById.size + 1}`;
      this._tableAliasById.set(id, result);
      return result;
   }

   next(text: string) {
      const tokens = this.tokenizer.tokenize(trim(text));

      for (let i = 0; i < tokens.length; i++) {
         const token = tokens[i]!;
         if (token === "(") {
            const prevToken =
               this.currentStack.length > 0 ? this.currentStack[this.currentStack.length - 1] : undefined;

            if (prevToken === "over" || prevToken === "apply") {
               this.currentStack.pop(); // consume 'over'
               this._contextParentDepths.push(this._parentDepth);
               this._keywordStacks.push([prevToken]);
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

   /**
    * Gets the query name for the respective SQL
    * @param token
    */
   getQueryName(token: SqlQueryAny | SqlQueryColumnAny | SqlSelectAllAny) {
      const query = (() => {
         switch (true) {
            case token instanceof SqlQuery:
               return token;
            case token instanceof SqlQueryColumn:
               return token.query;
            case token instanceof SqlSelectAll:
               return token.query;
            default:
               throw new SqlBuildError(`Unsupported token type: ${token}`);
         }
      })();

      const { name } = this.scope({ query }, () => {
         return this.queries.get(query.id)!;
      });

      // console.log(`getQueryName() ${token.id}: ${name}`);
      if (!name) {
         throw new SqlBuildError(
            `Query not found for '${token.id}'. If this is a subquery, it needs to be scoped into the build context.\n${this.text}`,
            {
               buildTokens: this.tokens,
               data: {
                  values: this.values,
               },
            },
         );
      }

      return name;
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
      try {
         this._tokens.push(...tokens);
      } catch (err) {
         console.error("Failed to add strings:", strings, " into _tokens:", this._tokens);
         throw err;
      }
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
    * Adds an expand parameter
    * @param expand
    */
   addExpand(expand: { id: string; expand: SqlExpandHandlerAny }) {
      this._tokens.push({
         id: expand.id,
         type: "expand",
         expand: expand.expand,
      });
   }

   beginScope(args: { query: SqlQueryAny; cte?: boolean; inline?: boolean; keepKeywords?: true }) {
      const keywords = args?.keepKeywords ? this._keywordStacks.at(-1) : null;
      this._keywordStacks.push(keywords ?? []);
      this._queryStack.push(args.query);

      if (!this.queries.has(args.query.id)) {
         const startIndex = this.queries.size;
         const queue = new Queue(args.query);
         let offset = 0;
         for (const query of queue.shift()) {
            if (!this.queries.has(query.id)) {
               this.queries.set(query.id, {
                  index: startIndex + offset,
                  query,
                  cte: false,
                  name: query.info?.label ?? `query_${startIndex + offset}`,
               });
               offset++;
               queue.add(...query.queries);
            }
         }
      }

      if (args.cte) {
         // Update CTE flag if query is already registered
         const existing = this.queries.get(args.query.id)!;
         this.queries.set(args.query.id, { ...existing, cte: true });
      }
   }

   endScope() {
      this._queryStack.pop();
      this._keywordStacks.pop();
   }

   /**
    * Stacks the current context with the query.
    * @param args
    * @param callback
    */
   scope<Result = undefined>(
      args: { query: SqlQueryAny; cte?: boolean; inline?: boolean; keepKeywords?: true },
      callback?: () => Result,
   ): typeof callback extends undefined ? void : Result {
      this.beginScope(args);

      if (args.inline || args.query.inline) {
         this.endScope();
         return typeof callback === "function" ? callback() : (undefined as Result);
      }

      try {
         return typeof callback === "function" ? callback() : (undefined as Result);
      } finally {
         this.endScope();
      }
   }

   /**
    * Checks if a query is a declared CTE
    * @param query
    */
   isCTE(query: SqlQueryAny): boolean {
      return this.queries.get(query.id)?.cte ?? false;
   }

   get query() {
      if (this._queryStack.length <= 0) throw new SqlBuildError(`Query stack is empty`);
      return this._queryStack.at(-1)!;
   }
}
