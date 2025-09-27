import { DefaultTokenizer, MAJOR_KEYWORDS, SqlBuildError } from "valnor";

export class Sqlite3Tokenizer extends DefaultTokenizer {
   constructor(queryName: string) {
      super(queryName);
   }

   // We override the entire tokenize method to allow the '?' and '$' parameter markers for SQLite3.
   override tokenize(text: string): string[] {
      const tokens: string[] = [];
      let i = 0;
      const lowerText = text.toLowerCase();

      console.log(`[${this.queryName}] Sqlite3Tokenizer.tokenize received text:`, text);
      console.log(`[${this.queryName}] Sqlite3Tokenizer.tokenize using MAJOR_KEYWORDS:`, MAJOR_KEYWORDS);

      while (i < text.length) {
         const remaining = lowerText.substring(i);

         const wsMatch = remaining.match(/^\s+/);
         if (wsMatch) {
            i += wsMatch[0].length;
            continue;
         }

         if (remaining.startsWith("--")) {
            const end = lowerText.indexOf("\n", i);
            i = end === -1 ? text.length : end;
            continue;
         }
         if (remaining.startsWith("/*")) {
            const end = lowerText.indexOf("*/", i);
            i = end === -1 ? text.length : end + 2;
            continue;
         }

         const quoteMatch = remaining.match(/^('|"|`)/);
         if (quoteMatch) {
            const quoteChar = quoteMatch[1]!;
            const ender = quoteChar;
            const end = lowerText.indexOf(ender, i + quoteChar.length);
            i = end === -1 ? text.length : end + ender.length;
            continue;
         }

         let matched = false;
         for (const keyword of MAJOR_KEYWORDS) {
            if (
               remaining.startsWith(keyword) &&
               (remaining.length === keyword.length || /\W/.test(remaining[keyword.length]!))
            ) {
               tokens.push(keyword);
               i += keyword.length;
               matched = true;
               break;
            }
         }
         if (matched) continue;

         const char = remaining[0]!;
         if ("(),".includes(char)) {
            tokens.push(char);
            i++;
            continue;
         }

         const tokenMatch = remaining.match(/^[a-z_][\w]*|^[0-9]+.?[0-9]*|^[-><>=!*+\/%?&|#~]+|^\$|^@/);
         if (tokenMatch) {
            const token = tokenMatch[0]!;
            if (token === "@") {
               throw new SqlBuildError(`Query contains forbidden parameter characters (@). Use param() instead.`, {
                  queryName: this.queryName,
               });
            }
            tokens.push(token);
            i += token.length;
            continue;
         }

         i++;
      }
      console.log(`[${this.queryName}] Sqlite3Tokenizer.tokenize produced tokens:`, tokens);
      return tokens;
   }
}
