import { beforeEach, describe, expect, test } from "vitest";
import { SqlQueryContext } from "../sql-query-context.js";

describe("QueryContext: next keyword", () => {
   let target!: SqlQueryContext;

   beforeEach(() => {
      target = new SqlQueryContext({ queryName: "test" });
   });

   test("select", () => {
      const command = target.next("select ");
      expect(command).toBe("select");
   });

   test("(select", () => {
      const command = target.next("(select ");
      expect(command).toBe("select");
   });

   test("from", () => {
      const command = target.next("select * from users");
      expect(command).toBe("from");
   });

   test("where", () => {
      const command = target.next("select * from users where name = 'Bob'");
      expect(command).toBe("where");
   });

   test("join", () => {
      const command = target.next("select * from users join orders");
      expect(command).toBe("join");
   });

   test("join ... on", () => {
      const command = target.next("select * from users join orders on users.user_id = orders.user_id");
      expect(command).toBe("on");
   });

   test("fn", () => {
      const command = target.next(`, min(`);
      expect(command).toBe("fn");
   });

   test("fn (2)", () => {
      const command = target.next(`" as enum_schema,\\n                   json_agg(`);
      expect(command).toBe("fn");
   });

   test("fn (3): back to select from fn call", () => {
      expect(target.next(`select `)).toBe("select");
      expect(target.keyword).toBe("select");
      expect(target.next(`, min(`)).toBe("fn");
      expect(target.keyword).toBe("fn");
      expect(target.matchKeyword("select", "fn")).toBe(true);
      expect(target.next(`), "`)).toBe("select");
      expect(target.keyword).toBe("select");
   });

   test("match select ... json_agg(...)", () => {
      const keywords = ["select ", ",", ", json_agg("];
      for (const keyword of keywords) {
         target.next(keyword);
      }

      expect(target.matchKeyword("select", "fn")).toBe(true);
   });

   test("match select ... join (...)", () => {
      const keywords = ["select ", ",", ", left join ("];
      for (const keyword of keywords) {
         target.next(keyword);
      }

      expect(target.matchKeyword("select", "join")).toBe(true);
   });
});
