import { test, expect } from "vitest";
import "@vexnor/mssql";
import { row, sql } from "vexnor";
import { jsonMany } from "@vexnor/mssql";
import { Account } from "./codegen/vexnor_dev.account-table.js";

test("jsonSchema", () => {
   const accountChildren = sql`
      select ${row(Account.as(`children`).$$)}
      from ${Account.as(`children`)}
      where ${Account.as(`children`).$parentId} = ${Account.out.$accountId}
   `;
   const query = sql`
      select ${row(Account.$$)}, ${jsonMany(accountChildren).as("children")}
      from ${Account} ${jsonMany(accountChildren)}
   `;
   expect(query.jsonSchema).toMatchInlineSnapshot(`
     {
       "children": [
         {
           "createdAt": "Date",
           "modifiedAt": "Date",
         },
       ],
       "createdAt": "Date",
       "modifiedAt": "Date",
     }
   `);
});
