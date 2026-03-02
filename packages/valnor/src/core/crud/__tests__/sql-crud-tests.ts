import { describe, test } from "vitest";
import { sql } from "../../sql.js";
import { param } from "../../query/index.js";
import { Account, IAccountSelect, IAccountUpdate } from "@test-models/valnor_test.account-table.js";
import { SqlTableCrud } from "../sql-table-crud.js";

describe("sql crud tests (types)", () => {
   test("check type for update query with where", () => {
      const where = sql`where ${Account.$accountId} = ${param<{ accountId: string }>("accountId")}`;
      const target = {} as SqlTableCrud<{ Select: IAccountSelect; Update: IAccountUpdate }>;
      // eslint-disable-next-line unused-imports/no-unused-vars
      const updateOne = target.update({ where });
   });
});
