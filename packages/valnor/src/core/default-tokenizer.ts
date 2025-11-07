import { ITokenizer } from "./sql-tokenizer.js";
import { SqlBuildError } from "./sql-build-error.js";
import { MAJOR_KEYWORDS } from "./sql-constants.js";

export class DefaultTokenizer implements ITokenizer {
   tokenize(text: string): string[] {
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
         const quoteMatch = remaining.match(/^('|"|`|\$\$)/);
         if (quoteMatch) {
            const quoteChar = quoteMatch[1]!;
            const ender = quoteChar === "$$" ? "$$" : quoteChar;
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
         const tokenMatch = remaining.match(/^[a-z_][\w]*|^[0-9]+.?[0-9]*|^[-><>=!*+\/%]+|^[?@]|\$[0-9]+/);
         if (tokenMatch) {
            const token = tokenMatch[0]!;
            if ("?@".includes(token) || token.startsWith("$")) {
               throw new SqlBuildError(`Query contains forbidden parameter characters (?, @, $). Use param() instead.`);
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
