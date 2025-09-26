import { logger } from "./logger.js";
import { parseSqlKeywords, SQL_KEYWORDS, SqlKeyword } from "./sql-keyword.js";

export interface SqlQueryContextOptions {
   keywords?: SqlKeyword[];
   rawString?: string;
   queryName: string;
}

export class SqlQueryContext {
   /**
    * The core level.
    * Root queries will have level=0.
    * Children queries will have level=1, 2, 3, etc.
    */
   queryLevel = -1;
   readonly keywords: SqlKeyword[] = [];
   rawString?: string;

   /**
    * The current core name.
    * This is used to identify the core in the logs.
    */
   queryName: string;

   strings: string[] = [];
   values: unknown[] = [];

   constructor(args: SqlQueryContextOptions) {
      this.keywords = [];
      if (args.keywords?.length) {
         this.keywords.push(...args.keywords);
      }

      this.rawString = args.rawString;
      this.queryName = args.queryName;
   }

   get keyword(): SqlKeyword | undefined {
      return this.keywords[this.keywords.length - 1];
   }

   next(text: string) {
      this.rawString = text;

      if (text.trimStart().startsWith(")") && this.keyword === "fn") {
         this.keywords.pop();
      }

      const keywords = parseSqlKeywords(text);
      this.keywords.push(...keywords);
   }

   matchKeyword(...keywords: SqlKeyword[]): boolean {
      if (this.keywords.length < keywords.length) {
         logger.info({ input: keywords, stack: this.keywords }, "matching keywords");
         return false;
      }
      for (let i = 0; i < keywords.length; i++) {
         if (keywords[i] !== this.keywords[this.keywords.length - keywords.length + i]) return false;
      }

      return true;
   }

   /**
    * Create a new child context and
    * @param args
    */
   child(args: SqlQueryContextOptions) {
      const result = new SqlQueryContext(args);
      result.strings = this.strings;
      result.values = this.values;

      return result;
   }
}

export function isSqlKeywordCandidate(token: string): boolean {
   return SQL_KEYWORDS.some((keyword) => keyword.startsWith(token));
}
