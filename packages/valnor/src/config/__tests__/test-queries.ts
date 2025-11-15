import { sql } from "../../cli/exec/__tests__/test-driver-setup.js";
import { param, row } from "../../core/index.js";
import { Account } from "../../core/__tests__/models/valnor_test.account-table.js";

export const findAccountById = sql`
   select ${row(Account.$$)}
   from ${Account}
   where ${Account.$accountId} = ${param("accountId")}
     and ${Account.$email} = ${param("email")}
`;

export const findAccountByEmail = sql`
   select ${row(Account.$$)}
   from ${Account}
   where ${Account.$email} = ${param("email")}
`;

export const listAccounts = sql`
   select ${row(Account.$$)}
   from ${Account}
`;
