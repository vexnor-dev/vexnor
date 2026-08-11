import { DefaultTokenizer, MAJOR_KEYWORDS, SqlBuildError } from "@vexnor/core";

export class DuckDBTokenizer extends DefaultTokenizer {
   constructor(public readonly queryName: string) {
      super();
   }

   override tokenize(text: string): string[] {
      const tokens: string[] = [];
      let i = 0;
      const lowerText = text.toLowerCase();

      while (i < text.length) {
         const remaining = lowerText.substring(i);
         const whitespace = remaining.match(/^\s+/);
         if (whitespace) {
            i += whitespace[0].length;
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

         const quote = remaining.match(/^('|'|"|`|\$\$)/);
         if (quote) {
            const quoteText = quote[1]!;
            const end = lowerText.indexOf(quoteText, i + quoteText.length);
            i = end === -1 ? text.length : end + quoteText.length;
            continue;
         }

         let matchedKeyword = false;
         for (const keyword of MAJOR_KEYWORDS) {
            if (remaining.startsWith(keyword) && (remaining.length === keyword.length || /\W/.test(remaining[keyword.length]!))) {
               tokens.push(keyword);
               i += keyword.length;
               matchedKeyword = true;
               break;
            }
         }
         if (matchedKeyword) continue;

         const character = remaining[0]!;
         if ("(),".includes(character)) {
            tokens.push(character);
            i++;
            continue;
         }

         const tokenMatch = remaining.match(/^[a-z_][\w]*|^[0-9]+.?[0-9]*|^[-><>=!*+\/%?&|#~:]+|^[@]|^\$[0-9]+/);
         if (tokenMatch) {
            const token = tokenMatch[0]!;
            if (token === "@" || token.startsWith("$")) {
               throw new SqlBuildError(
                  `Query contains forbidden parameter characters (@, $). Use param() instead. Query: ${this.queryName}`,
               );
            }
            tokens.push(token);
            i += token.length;
            continue;
         }
         i++;
      }

      return tokens;
   }
}
