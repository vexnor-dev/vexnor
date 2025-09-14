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
   | "by"
   | "group by"
   | "order by";

export const SQL_KEYWORDS: SqlKeyword[] = x(() => {
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
      "order by": null,
      by: null,
   };
   return Object.keys(obj) as SqlKeyword[];
});

export function parseSqlKeywords(text: string): SqlKeyword[] {
   const results: SqlKeyword[] = [];
   const tokens = text.toLowerCase().match(/\w+\s*\(|\w+|\S/g) || [];

   for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i]!.trim();

      // Check for function calls
      if (/\w+\s*\(/.test(token)) {
         const funcName = token.replace(/\s*\(.*/, "");
         if (SQL_KEYWORDS.includes(funcName as SqlKeyword) && funcName !== "fn") {
            results.push(funcName as SqlKeyword);
         } else {
            results.push("fn");
         }
         continue;
      }

      // Check for multi-word keywords
      if (token === "group" && tokens[i + 1] === "by") {
         results.push("group by");
         i++;
         continue;
      }
      if (token === "order" && tokens[i + 1] === "by") {
         results.push("order by");
         i++;
         continue;
      }

      // Check for single-word keywords
      if (SQL_KEYWORDS.includes(token as SqlKeyword) && token !== "fn") {
         results.push(token as SqlKeyword);
      }
   }

   return results;
}
