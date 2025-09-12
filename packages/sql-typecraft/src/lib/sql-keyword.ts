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
   };
   return Object.keys(obj) as SqlKeyword[];
});

export const SQL_KEYWORD_CHECKS: Partial<Record<SqlKeyword, string[]>> = {
   select: ["(select"],
};
