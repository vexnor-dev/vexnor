import { ITokenizer } from "../sql-tokenizer.js";
import { MAJOR_KEYWORDS, SUBQUERY_STARTERS } from "../sql-constants.js";
import { DefaultFormatter } from "../default-formatter.js";
import { ISqlQueryContext } from "../sql-types.js";
import { DefaultTokenizer } from "../default-tokenizer.js";
import { quote, trim } from "../utils/index.js";
import { ok } from "assert";

export type SqlQueryContextOptions = {
   tokenizer?: ITokenizer;
   formatter?: DefaultFormatter;
   tableAliasById?: Map<string, string>;
   strings?: string[];
   values?: unknown[];
   queryName?: string;
   queryIndex?: number;
   stack?: {
      keywordStacks: string[][];
      contextParentDepths: number[];
      parentDepth: number;
   };
};

export class SqlQueryContext implements ISqlQueryContext {
   readonly tokenizer: ITokenizer;
   readonly formatter: DefaultFormatter;
   readonly queryIndex: number;
   readonly queryName: string;

   private readonly _strings: string[];
   private readonly _values: unknown[];
   private readonly _keywordStacks: string[][];
   private readonly _contextParentDepths: number[];
   private _parentDepth;
   private readonly _tableAliasById: Map<string, string>;

   constructor(options?: SqlQueryContextOptions) {
      this.queryIndex = options?.queryIndex ?? 0;
      this.queryName = options?.queryName ?? `query_${this.queryIndex}`;

      this.tokenizer = options?.tokenizer ?? new DefaultTokenizer();
      this.formatter = options?.formatter ?? new DefaultFormatter();
      this._tableAliasById = options?.tableAliasById ?? new Map<string, string>();

      this._keywordStacks = options?.stack?.keywordStacks ?? [[]];
      this._contextParentDepths = options?.stack?.contextParentDepths ?? [0];
      this._parentDepth = options?.stack?.parentDepth ?? 0;

      this._strings = options?.strings ? options.strings : [];
      this._values = options?.values ? options.values : [];
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

   private get currentStack(): string[] {
      return this._keywordStacks[this._keywordStacks.length - 1]!;
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

   scope(options?: { queryName?: string }): SqlQueryContext {
      const queryIndex = this.queryIndex + 1;
      return new SqlQueryContext({
         queryIndex: queryIndex,
         queryName: options?.queryName ?? `query_${queryIndex}`,
         values: this._values,
         strings: this._strings,
         tableAliasById: this._tableAliasById,
         tokenizer: this.tokenizer,
         formatter: this.formatter,
         stack: {
            contextParentDepths: this._contextParentDepths,
            keywordStacks: this._keywordStacks,
            parentDepth: this._parentDepth,
         },
      });
   }

   get text() {
      return this._strings.join("");
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
