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
   | "as";

export type SqlQueryMode = "root" | "child";

export interface SqlQueryContextOptions {
   readonly mode: SqlQueryMode;
   readonly keywords?: SqlKeyword[];
   readonly rawString: string;
}

export class SqlQueryContext {
   queryCount: number = 0;
   mode: SqlQueryMode;
   private __keywords__: SqlKeyword[] = [];
   private __rawString__?: string;

   constructor(
      args: {
         mode: SqlQueryMode;
         keywords?: SqlKeyword[];
         rawString?: string;
      } = { mode: "root" },
   ) {
      this.mode = args.mode;
      this.__keywords__ = args.keywords ?? [];
      this.__rawString__ = args.rawString;
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
      let maxIndex = -1;
      let result = undefined;
      let index = undefined;
      for (let i = 0; i < keywords.length; i++) {
         index = -1;
         switch (keywords[i]) {
            case "fn":
               index = getLastFunctionIndex(__text__);
               if (maxIndex < index) {
                  result = keywords[i];
                  maxIndex = index;
               }
               break;
            default:
               index = __text__.lastIndexOf(`${keywords[i]} `);
               if (index === -1) index = __text__.lastIndexOf(` ${keywords[i]}`);
               if (index === -1) index = __text__.lastIndexOf(`\n${keywords[i]}`);
               if (maxIndex < index) {
                  result = keywords[i];
                  maxIndex = index;
               }
               break;
         }
      }

      if (result) {
         this.__keywords__.push(result);
      } else if (this.keyword === "fn" && text.includes(")")) {
         this.__keywords__.pop();
      }

      if (this.__keywords__.length > 0) return this.__keywords__[this.__keywords__.length - 1];
      return undefined;
   }
}

function getLastFunctionIndex(text: string): number {
   const matches = Array.from(text.matchAll(/\b[a-zA-Z_][a-zA-Z0-9_]*\s*\(/g));
   return matches.length > 0 ? matches[matches.length - 1]!.index : -1;
}

const keywords = [
   "select",
   "insert",
   "update",
   "delete",
   "join",
   "from",
   "fn",
   "on",
   "where",
   "set",
   "values",
   "with",
   "returning",
] as const satisfies readonly SqlKeyword[];
