import { DefaultTokenizer, MAJOR_KEYWORDS, SqlBuildError } from "valnor";

export class MssqlTokenizer extends DefaultTokenizer {
   constructor(queryName: string) {
      super(queryName);
   }

   // We override the entire tokenize method to allow the '@' parameter marker for MSSQL.
   override tokenize(text: string): string[] {
      const tokens: string[] = [];
      let i = 0;
      const lowerText = text.toLowerCase();

      while (i < text.length) {
         const remaining = lowerText.substring(i);

         // 1. Skip whitespace
         const wsMatch = remaining.match(/^\s+/);
         if (wsMatch) {
            i += wsMatch[0].length;
            continue;
         }

         // 2. Comments and Quoted Strings
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
         const quoteMatch = remaining.match(/^('|"|`)/); // MSSQL doesn't typically use $$ for strings
         if (quoteMatch) {
            const quoteChar = quoteMatch[1]!;
            const ender = quoteChar;
            const end = lowerText.indexOf(ender, i + quoteChar.length);
            i = end === -1 ? text.length : end + ender.length;
            continue; // The content of strings is ignored and not tokenized
         }

         // 3. Multi-word keywords (longest first)
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

         // 4. Single character tokens
         const char = remaining[0]!;
         if ("(),".includes(char)) {
            tokens.push(char);
            i++;
            continue;
         }

         // 5. Identifiers, operators, and forbidden params
         // This is the key modification: we allow '@' and '$' (for $1, $2 etc) but forbid '?'
         const tokenMatch = remaining.match(/^[a-z_][\w]*|^[0-9]+.?[0-9]*|^[-><>=!*+\/%]+|^\$|^@/);
         if (tokenMatch) {
            const token = tokenMatch[0]!;
            if (token === "?") {
               throw new SqlBuildError(`Query contains forbidden parameter characters (?). Use param() instead.`, {
                  queryName: this.queryName,
               });
            }
            tokens.push(token);
            i += token.length;
            continue;
         }

         // Failsafe for unknown characters
         i++;
      }
      return tokens;
   }
}
