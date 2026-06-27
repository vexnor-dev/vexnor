import { DefaultFormatter } from "#src/core/builder/default-formatter.js";
import { type SqlLanguage } from "#src/format/sql-language.js";
import { getFormatter } from "#src/format/formatter-registry.js";
import { DefaultTokenizer } from "#src/core/builder/default-tokenizer.js";
import { SqlQuery, SqlQueryAny } from "#src/core/query/sql-query.js";
import { SqlBuildOptions } from "#src/core/builder/sql-build-options.js";
import { ITokenizer } from "#src/core/builder/sql-tokenizer.js";
import { SqlBuildToken, SqlOperatorToken } from "#src/core/query/sql-models.js";
import { SqlBuildError } from "#src/core/sql-build-error.js";
import { MAJOR_KEYWORDS, SUBQUERY_STARTERS } from "#src/core/sql-constants.js";
import { getTableId, SqlTableIdentity } from "#src/core/schema/sql-table-identity.js";
import { getAliasStackInfo } from "#src/core/query/lib/get-alias-stack-info.js";
import { SqlSelectAll, SqlSelectAllAny } from "#src/core/query/sql-select-all.js";
import { SqlQueryColumn, SqlQueryColumnAny } from "#src/core/query/sql-query-column.js";
import { Queue } from "#src/lib/queue.js";
import { SqlQueryScope } from "#src/core/query/sql-query-types.js";
import { quoteText } from "#src/core/utils/quote-text.js";
import { trim } from "#src/core/utils/trim.js";
import { ok } from "#src/lib/assert.js";
import { SqlQueryRef, SqlQueryRefAny } from "#src/core/query/sql-query-ref.js";
import { isPrimitive } from "#src/lib/primitive.js";

export type SqlBuildContextArgs = SqlBuildOptions & Partial<Pick<SqlBuildContext, "query" | "params" | "tag">>;

type QueryInfo = { index: number; query: SqlQueryAny; cte: boolean; name: string };
type TableId = string;
type TableAlias = string;

export class SqlBuildContext {
   readonly tokenizer: ITokenizer;
   readonly formatter: DefaultFormatter;
   readonly dialect: SqlLanguage;
   readonly queries = new Map<string, QueryInfo>();
   readonly params: Readonly<Record<string, unknown>> | null;
   readonly tag: string | null;

   private readonly _tokens: SqlBuildToken[];
   private readonly _keywordStacks: string[][];
   private readonly _contextParentDepths: number[];
   private _parentDepth: number = 0;
   private _queryStack: SqlQueryAny[];
   private readonly _tableAliasStack: Map<TableId, TableAlias>[];
   private _aliasCounter = 1;

   constructor(args?: SqlBuildContextArgs) {
      this.tokenizer = args?.tokenizer ?? new DefaultTokenizer();
      this.formatter = args?.formatter ?? new DefaultFormatter();
      this.dialect = args?.dialect ?? "sql";
      this.params = args?.params ?? null;

      this._tokens = [];
      this._keywordStacks = [[]];
      this._contextParentDepths = [0];
      this._queryStack = [];
      this._tableAliasStack = [];
      this._tableAliasStack.push(new Map().set("$queryId", "-"));
      this.tag = args?.tag ?? null;
      if (args?.query) {
         this.addQuery(args.query);
      }
   }

   get text() {
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
               if (!isPrimitive(token.value)) {
                  throw new SqlBuildError(
                     `Unexpected non-primitive value token — only primitives, null, Date, and Uint8Array are allowed`,
                  );
               }
               text += "?";
               break;
            case "operator":
               text += `/* <${token.operator.type}> */`;
               break;
            default:
               throw new SqlBuildError(`Unknown token type ${typeof token}: ${token}`);
         }
      }

      const formatter = getFormatter();
      if (!formatter) return text + "\n";
      try {
         return formatter(text + "\n", {
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

   get keyword(): string | undefined {
      const stack = this.keywordStack;
      for (let i = stack.length - 1; i >= 0; i--) {
         const keyword = stack[i]!;
         if (MAJOR_KEYWORDS.has(keyword)) {
            return keyword;
         }
      }
      return undefined;
   }

   get keywordStack(): string[] {
      ok(this._keywordStacks.length, `Current stack is empty`);
      return this._keywordStacks.at(-1)!;
   }

   get tableAliasStack() {
      return this._tableAliasStack.at(-1);
   }

   get query() {
      return this._queryStack.at(-1);
   }

   *keywords(): IterableIterator<string> {
      const stack = this.keywordStack;
      for (let i = stack.length - 1; i >= 0; i--) {
         const keyword = stack[i]!;
         if (MAJOR_KEYWORDS.has(keyword)) {
            yield keyword;
         }
      }
   }

   setAlias(tableIdentity: Pick<SqlTableIdentity, "name" | "schema">, { alias }: Pick<SqlTableIdentity, "alias">) {
      if (!alias) return;

      const tableId = getTableId(tableIdentity);
      ok(this.tableAliasStack, `'this.tableAliasStack' is required.`);
      this.tableAliasStack.set(tableId, alias);
   }

   getAlias(tableIdentity: SqlTableIdentity) {
      const tableId = getTableId(tableIdentity);
      if (tableIdentity.alias) {
         return tableIdentity.alias;
      }

      if (tableIdentity.out) {
         const queue = new Queue(this._tableAliasStack.toSpliced(-1));
         for (const alias of queue.pop()) {
            if (alias.has(tableId)) return alias.get(tableId)!;
         }

         console.log(`
         Table ID: ${tableId}
         Current query: ${this.query?.label ?? "-"}
         Current alias stack: ${getAliasStackInfo(this._tableAliasStack)}
         `);

         throw new SqlBuildError(` No alias found for table '${tableId}'+out in the current context.`);
      }

      if (this.tableAliasStack?.has(tableId)) {
         return this.tableAliasStack.get(tableId);
      }

      const token = tableIdentity.name
         .split("_")
         .map((z) => z[0])
         .join("");
      const result = `${token}_${this._aliasCounter++}`;
      this.tableAliasStack?.set(tableId, result);
      return result;
   }

   next(text: string) {
      const tokens = this.tokenizer.tokenize(trim(text));

      for (let i = 0; i < tokens.length; i++) {
         const token = tokens[i]!;
         if (token === "(") {
            const prevToken =
               this.keywordStack.length > 0 ? this.keywordStack[this.keywordStack.length - 1] : undefined;

            if (prevToken === "over" || prevToken === "apply") {
               this.keywordStack.pop(); // consume 'over'
               this._contextParentDepths.push(this._parentDepth);
               this._keywordStacks.push([prevToken]);
            } else if (prevToken && SUBQUERY_STARTERS.includes(prevToken)) {
               this._contextParentDepths.push(this._parentDepth);
               this._keywordStacks.push([prevToken]);
            } else if (prevToken && /^[a-z_]/.test(prevToken) && !MAJOR_KEYWORDS.has(prevToken)) {
               this.keywordStack.pop(); // It's a function call, consume the name
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
            this.keywordStack.push(token);
         }
      }
   }

   getQueryName(token: SqlQueryAny | SqlQueryColumnAny | SqlSelectAllAny | SqlQueryRefAny) {
      let query: SqlQueryAny | undefined = undefined;
      switch (true) {
         case token instanceof SqlQueryRef:
            if (token.out) {
               query = this._queryStack.at(-1)!;
               break;
            }

            query = token.innerQuery;
            break;
         case token instanceof SqlQuery:
            query = token;
            break;
         case token instanceof SqlQueryColumn:
            if (token.query instanceof SqlQuery) {
               query = token.query;
               break;
            }

            if (token.query.out) {
               query = this._queryStack.at(-1)!;
               break;
            }

            query = token.query.innerQuery;
            break;
         case token instanceof SqlSelectAll:
            query = token.innerQuery;
            break;
         default:
            throw new SqlBuildError(`Unsupported token type: ${token}`);
      }

      const { name } = this.addQuery(query);
      ok(name, `No SqlQuery found for level '${token.id}'.`);
      return name;
   }

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

   addQuotes(...quotes: string[]) {
      ok(quotes[0], `quotes is required`);
      const tokens: SqlBuildToken[] = quotes.map((value) => {
         return { type: "text", value: quoteText(value) };
      });
      this._tokens.push(...tokens);
   }

   addValues(...values: unknown[]) {
      for (const value of values) {
         this._tokens.push({ type: "value", value: value ?? null });
      }
   }

   addParam(param: { name: string }) {
      this._tokens.push({
         type: "param",
         name: param.name,
      });
   }

   addOperator(operator: SqlOperatorToken) {
      this._tokens.push({ type: "operator", operator });
   }

   addQuery(query: SqlQueryAny, override?: Pick<QueryInfo, "cte">) {
      if (!this.queries.has(query.id)) {
         const startIndex = this.queries.size;
         const queue = new Queue([query]);
         let offset = 0;
         for (const innerQuery of queue.shift()) {
            if (!this.queries.has(innerQuery.id)) {
               this.queries.set(innerQuery.id, {
                  index: startIndex + offset,
                  query: innerQuery,
                  name: innerQuery.info?.label ?? `query_${startIndex + offset}`,
                  cte: false,
                  ...(override ?? {}),
               });
               offset++;
               queue.push(...innerQuery.innerQueries);
            }
         }

         return this.queries.get(query.id)!;
      }

      if (override) {
         const existing = this.queries.get(query.id)!;
         this.queries.set(query.id, { ...existing, ...override });
      }

      return this.queries.get(query.id)!;
   }

   scope<Result = undefined>(
      query: SqlQueryAny,
      callback: () => Result,
      args: SqlQueryScope = {
         queryType: "inline",
      },
   ): typeof callback extends undefined ? void : Result {
      if (typeof args.cte === "boolean") {
         this.addQuery(query, {
            cte: args.cte,
         });
      } else this.addQuery(query);

      switch (args.queryType) {
         case "main":
            this._queryStack.push(query);
            this._keywordStacks.push([]);
            this._tableAliasStack.push(new Map().set("$queryId", query.id).set("$query", query.label));
            break;
         case "inline":
         case null:
         case undefined:
            break;
         default:
            throw new SqlBuildError(`Unknown query type: ${args.queryType}`);
      }

      try {
         return typeof callback === "function" ? callback() : (undefined as Result);
      } finally {
         if (args.queryType === "main") {
            this._queryStack.pop();
            this._keywordStacks.pop();
            this._tableAliasStack.pop();
         }
      }
   }

   isCTE(query: SqlQueryAny): boolean {
      ok(this.queries.has(query.id), `SqlQuery not registered in this context: ${query.id}`);
      return this.queries.get(query.id)!.cte;
   }
}
