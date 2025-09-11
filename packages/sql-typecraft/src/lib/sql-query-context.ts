import { logger } from "../cli/logger.js";
import { x } from "./x.js";

export type SqlKeyword =
   | "select"
   | "insert"
   | "update"
   | "delete"
   | "join"
   | "from"
   | "fn"
   | "on"
   | "where"
   | "set"
   | "values"
   | "with"
   | "returning"
   | "group by";

export type SqlQueryMode = "root" | "child";

export interface SqlQueryContextOptions {
   readonly keywords?: SqlKeyword[];
   readonly rawString?: string;
   readonly queryName: string;
}

export class SqlQueryContext {
   /**
    * The query level.
    * Root queries will have level=0.
    * Children queries will have level=1, 2, 3, etc.
    */
   queryLevel = -1;
   private __keywords__: SqlKeyword[] = [];
   private __rawString__?: string;

   /**
    * The current query name.
    * This is used to identify the query in the logs.
    */
   queryName: string;

   strings: string[] = [];
   values: unknown[] = [];

   constructor(args: SqlQueryContextOptions) {
      this.__keywords__ = args.keywords ?? [];
      this.__rawString__ = args.rawString;
      this.queryName = args.queryName;
   }

   get keywords() {
      return Object.freeze(this.__keywords__);
   }

   get keyword(): SqlKeyword | undefined {
      if (this.__keywords__.length === 0) return undefined;
      return this.__keywords__[this.__keywords__.length - 1];
   }

   set keyword(keyword: SqlKeyword) {
      this.__keywords__.length = 0;
      this.__keywords__.push(keyword);
   }

   get rawString(): string | undefined {
      return this.__rawString__;
   }

   next(text: string) {
      this.__rawString__ = text;
      const __text__ = text.toLocaleLowerCase();

      for (const token of __text__.toLocaleLowerCase().split(/\s+/)) {
         if (!token) continue;

         for (const keyword of keywords) {
            if (token === keyword) {
               this.__keywords__.push(keyword);
               break;
            }

            if (checks[keyword]?.includes(token)) {
               this.__keywords__.push(keyword);
               break;
            }
         }
      }

      switch (true) {
         case __text__.endsWith("(") && !__text__.endsWith(" ("):
            this.__keywords__.push("fn");
            break;
         case __text__.startsWith(")") && this.keyword === "fn":
            this.__keywords__.pop();
            break;
      }

      return this.__keywords__.length > 0 ? this.__keywords__[this.__keywords__.length - 1] : undefined;
   }

   matchKeyword(...keywords: SqlKeyword[]): boolean {
      if (this.__keywords__.length < keywords.length) {
         logger.info({ input: keywords, stack: this.__keywords__ }, "matching keywords");
         return false;
      }
      for (let i = 0; i < keywords.length; i++) {
         if (keywords[i] !== this.__keywords__[this.__keywords__.length - keywords.length + i]) return false;
      }

      return true;
   }
}

const keywords: SqlKeyword[] = x(() => {
   const obj: Record<SqlKeyword, null> = {
      select: null,
      insert: null,
      update: null,
      delete: null,
      join: null,
      from: null,
      fn: null,
      on: null,
      where: null,
      set: null,
      values: null,
      with: null,
      returning: null,
      "group by": null,
   };
   return Object.keys(obj) as SqlKeyword[];
});

const checks: Partial<Record<SqlKeyword, string[]>> = {
   select: ["(select"],
};
