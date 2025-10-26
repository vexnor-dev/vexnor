import { ITokenizer } from "../sql-tokenizer.js";
import { MAJOR_KEYWORDS, SUBQUERY_STARTERS } from "../sql-constants.js";
import { DefaultFormatter } from "../default-formatter.js";
import { ISqlQueryContext } from "../sql-types.js";
import { DefaultTokenizer } from "../default-tokenizer.js";
import { trim } from "../trim.js";

export interface SqlQueryContextOptions {
   queryName: string;
   tokenizer?: ITokenizer;
   formatter?: DefaultFormatter;
   tableAliasById?: Map<string, string>;
   strings?: string[];
   values?: unknown[];
}

export class SqlQueryContext implements ISqlQueryContext {
   readonly tokenizer: ITokenizer;
   readonly formatter: DefaultFormatter;
   readonly queryName: string;
   rawString?: string;
   strings: string[];
   values: unknown[];
   private readonly keywordStacks: string[][] = [[]];
   private readonly contextParenDepths: number[] = [0];
   private parentDepth = 0;
   private readonly tableAliasById: Map<string, string>;

   constructor(args: SqlQueryContextOptions) {
      this.queryName = args.queryName;
      this.tokenizer = args.tokenizer ?? new DefaultTokenizer(this.queryName);
      this.formatter = args.formatter ?? new DefaultFormatter();
      this.tableAliasById = args.tableAliasById ?? new Map<string, string>();
      this.strings = args.strings ?? [];
      this.values = args.values ?? [];
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
      return this.keywordStacks[this.keywordStacks.length - 1]!;
   }

   setAlias(tableInfo: { schema?: string; name: string; alias?: string }) {
      if (!tableInfo.alias) return;

      const id = tableInfo.schema ? `${tableInfo.schema}.${tableInfo.name}` : tableInfo.name;
      this.tableAliasById.set(id, tableInfo.alias);
   }

   /**
    * Gets the alias for the respective tableInfo.
    * @param tableInfo
    */
   alias(tableInfo: { schema?: string; name: string; alias?: string }) {
      if (tableInfo.alias) return tableInfo.alias;

      const id = tableInfo.schema ? `${tableInfo.schema}.${tableInfo.name}` : tableInfo.name;
      if (!this.tableAliasById.has(id)) {
         const token = tableInfo.name
            .split("_")
            .map((z) => z[0])
            .join("");
         this.tableAliasById.set(id, `${token}_${this.tableAliasById.size + 1}`);
      }

      return this.tableAliasById.get(id)!;
   }

   next(text: string) {
      this.rawString = text;
      const tokens = this.tokenizer.tokenize(trim(text));

      for (let i = 0; i < tokens.length; i++) {
         const token = tokens[i]!;
         if (token === "(") {
            const prevToken =
               this.currentStack.length > 0 ? this.currentStack[this.currentStack.length - 1] : undefined;

            if (prevToken === "over") {
               this.currentStack.pop(); // consume 'over'
               this.contextParenDepths.push(this.parentDepth);
               this.keywordStacks.push(["over"]);
            } else if (prevToken && SUBQUERY_STARTERS.includes(prevToken)) {
               this.contextParenDepths.push(this.parentDepth);
               this.keywordStacks.push([prevToken]);
            } else if (prevToken && /^[a-z_]/.test(prevToken) && !MAJOR_KEYWORDS.includes(prevToken)) {
               this.currentStack.pop(); // It's a function call, consume the name
               this.contextParenDepths.push(this.parentDepth);
               this.keywordStacks.push(["fn"]);
            } else {
               const nextMeaningfulToken = tokens.slice(i + 1).find((t) => t.trim());
               if (nextMeaningfulToken === "select") {
                  this.contextParenDepths.push(this.parentDepth);
                  this.keywordStacks.push([]);
               }
            }
            this.parentDepth++;
         } else if (token === ")") {
            this.parentDepth--;
            if (
               this.keywordStacks.length > 1 &&
               this.parentDepth === this.contextParenDepths[this.contextParenDepths.length - 1]!
            ) {
               this.keywordStacks.pop();
               this.contextParenDepths.pop();
            }
         } else {
            this.currentStack.push(token);
         }
      }
   }

   child(args: { queryName: string }): SqlQueryContext {
      return new SqlQueryContext({
         ...args,
         tokenizer: this.tokenizer,
         formatter: this.formatter,
         tableAliasById: this.tableAliasById,
         strings: this.strings,
         values: this.values,
      });
   }
}
