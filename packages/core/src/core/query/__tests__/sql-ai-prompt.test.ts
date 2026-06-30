import { describe, expect, test } from "vitest";
import { sqlSelect } from "#src/core/crud/sql-select.js";
import { sql } from "#src/core/sql.js";
import { row } from "#src/core/query/sql-select-row.js";
import { param } from "#src/core/query/sql-param.js";
import { Account } from "@test-models/vexnor_dev.schema.js";

describe("getAiPrompt — auto-generated AI documentation", () => {
   test("CRUD select() produces full AI docs from all operators", () => {
      const query = sqlSelect(Account, {});
      const prompt = query.source.getAiPrompt();
      expect(prompt).toMatchInlineSnapshot(`
        "select: object where key=output alias. Values: true (same-name column), "sourceCol" (rename column), or {fn,col,args?} for functions.
          Aggregates (fn): sum, count, avg, min, max. Example: {"fn":"count","col":"*"}, {"fn":"sum","col":"amount"}
          Transforms (fn): dateTrunc, coalesce, round, abs, concat.
            dateTrunc: args = "year"|"month"|"day"|"hour". Example: {"fn":"dateTrunc","col":"paymentDate","args":"month"}
            coalesce: args = default value or [fallback1, fallback2]. Example: {"fn":"coalesce","col":"notes","args":"N/A"}
            round: args = [precision]. Example: {"fn":"round","col":"amount","args":[2]}
            abs: no args needed. Example: {"fn":"abs","col":"amount"}
            concat: args = [parts to append]. Example: {"fn":"concat","col":"firstName","args":[" ","lastName"]}
        orderBy: {"columnName": "ASC"|"DESC"}. Key is the column name, value is direction. Aggregate aliases from select also work.
        limit: number (max rows). offset: number (skip rows). ALWAYS pass limit.
        filterBy: [{col: value}] or [{col: ["op", ...args]}]. Ops: =, not, !=, >, >=, <, <=, between, in, notIn, like, notLike, isNull, isNotNull. OR groups: {or: [...]}. ONLY real table columns — never aggregate aliases.
        havingBy: [{alias: value}] or [{alias: ["op", ...args]}]. Filter on aggregate aliases from select. Ops: =, !=, >, >=, <, <=, between, in, notIn. Alias must match a key in select that has an aggregate fn."
      `);
   });

   test("raw sql query without operators returns empty string", () => {
      const query = sql`SELECT ${row(Account.$$)} FROM ${Account} WHERE ${Account.$accountId} = ${param<{ id: string }>("id")}`;
      const prompt = query.getAiPrompt();
      expect(prompt).toMatchInlineSnapshot(`""`);
   });

   test("deduplicates — same operator type appears only once", () => {
      const query = sqlSelect(Account, {});
      const prompt = query.source.getAiPrompt();
      const filterLines = prompt.split("\n").filter(l => l.startsWith("filterBy:"));
      expect(filterLines.length).toBe(1);
   });
});
