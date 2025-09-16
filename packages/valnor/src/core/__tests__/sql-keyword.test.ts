import { describe, expect, test } from "vitest";
import { parseSqlKeywords } from "../sql-keyword.js";
import { logger } from "../logger.js";

describe("SqlKeyword parseSqlKeywords()", () => {
   test(`"select * from(select a, min(b) from test group by a)"`, ({ task }) => {
      const tokens = parseSqlKeywords(task.name);
      logger.info({ tokens }, "tokens");
      expect(tokens).toEqual(["select", "from", "select", "fn", "from", "group by"]);
   });
});
