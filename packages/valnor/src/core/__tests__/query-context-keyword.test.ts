import { beforeEach, describe, expect, test } from "vitest";
import { SqlQueryContext } from "../sql-query-context.js";

describe("QueryContext: next keyword", () => {
   let target!: SqlQueryContext;

   beforeEach(() => {
      target = new SqlQueryContext({ queryName: "test" });
   });

   test("select", () => {
      target.next("select ");
      expect(target.keywords).toEqual(["select"]);
   });

   test("order by", () => {
      target.next("order by ");
      expect(target.keywords).toEqual(["order by"]);
   });

   test.each(["(select", ")select", "select(", "select"])("select with brackets: %s", (input) => {
      target.next(input);
      expect(target.keywords).toEqual(["select"]);
      expect(target.keyword).toEqual("select");
   });

   test("from", () => {
      target.next("select * from users");
      expect(target.keywords).toEqual(["select", "from"]);
   });

   test("where", () => {
      target.next("select * from users where name = 'Bob'");
      expect(target.keywords).toEqual(["select", "from", "where"]);
   });

   test("join", () => {
      target.next("select * from users join orders");
      expect(target.keywords).toEqual(["select", "from", "join"]);
   });

   test("join ... on", () => {
      target.next("select * from users join orders on users.user_id = orders.user_id");
      expect(target.keywords).toEqual(["select", "from", "join", "on"]);
   });

   test("fn", () => {
      target.next(`, min(`);
      expect(target.keywords).toEqual(["fn"]);
   });

   test("fn (2)", () => {
      target.next(`" as enum_schema,\\n                   json_agg(`);
      expect(target.keywords).toEqual(["fn"]);
   });

   test("fn (3): back to select from fn call", () => {
      target.next(`select `);
      expect(target.keyword).toBe("select");

      target.next(`, min(`);
      expect(target.keywords).toEqual(["select", "fn"]);

      target.next(`), "`);
      expect(target.keywords).toEqual(["select"]);
   });

   test("match select ... json_agg(...)", () => {
      const keywords = ["select ", ",", ", json_agg("];
      for (const keyword of keywords) {
         target.next(keyword);
      }

      expect(target.keywords).toEqual(["select", "fn"]);
   });

   test("match select ... join (...)", () => {
      const keywords = ["select ", ",", ", left join ("];
      for (const keyword of keywords) {
         target.next(keyword);
      }

      expect(target.matchKeyword("select", "join")).toBe(true);
   });
});
