import "@vexnor/sqlite3";
import { sql, row, param, set, insert, filterBy, orderBy, when } from "@vexnor/core";
import { Account } from "../codegen/sqlite3/main.account-table.js";

type SelectP = { status: string };
type UpdateP = { set: { email?: string; firstName?: string; lastName?: string }; accountId: string };
type ConditionalP = { status: string; hasEmail: boolean; email: string };

export const selectByStatus = sql`
   SELECT ${row(Account.$$)}
   FROM ${Account}
   WHERE ${Account.$status} = ${param<SelectP>("status")}
`;

export const selectWithFilter = sql`
   SELECT ${row(Account.$$)}
   FROM ${Account}
   WHERE ${filterBy(Account, "filter")}
`;

export const insertAccounts = sql`
   INSERT INTO ${Account}
   ${insert(Account, "rows")}
   RETURNING ${row(Account.$$)}
`;

export const updateAccount = sql`
   UPDATE ${Account}
   ${set(Account, "set")}
   WHERE ${Account.$accountId} = ${param<UpdateP>("accountId")}
   RETURNING ${row(Account.$$)}
`;

export const selectOrdered = sql`
   SELECT ${row(Account.$$)}
   FROM ${Account}
   ${orderBy(Account, "order")}
`;

export const selectConditional = sql`
   SELECT ${row(Account.$$)}
   FROM ${Account}
   WHERE ${Account.$status} = ${param<ConditionalP>("status")}
   ${when<{ email: string }>("email", sql`AND ${Account.$email} = ${param<ConditionalP>("email")}`)}
`;
