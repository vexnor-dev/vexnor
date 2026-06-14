import { param } from "#/core/query/sql-param.js";
import { row } from "#/core/query/sql-select-row.js";
import { Account } from "@test-models/vexnor_dev.account-table.js";
import { sql } from "#/test/mock-sql.js";

export const findAccountById = sql`
   select ${row(Account.$$)}
   from ${Account}
   where ${Account.$accountId} = ${param<{ accountId: string }>("accountId")}
     and ${Account.$email} = ${param<{ email: string }>("email")}
`;

export const findAccountByEmail = sql`
   select ${row(Account.$$)}
   from ${Account}
   where ${Account.$email} = ${param<{ email: string }>("email")}
`;

export const listAccounts = sql`
   select ${row(Account.$$)}
   from ${Account}
`;
