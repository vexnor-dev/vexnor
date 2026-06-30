import "@vexnor/mssql";
import { filterBy, insert, orderBy, param, row, set, sql, when } from "@vexnor/core";
import { Account } from "../codegen/mssql/vexnor_dev.account-table.js";

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
   (${insert.cols(Account, "rows")})
   OUTPUT ${row(Account.as`inserted`.$$)}
   VALUES ${insert.values(Account, "rows")}
`;

export const updateAccount = sql`
   UPDATE ${Account}
   ${set(Account, "set")}
   WHERE ${Account.$accountId} = ${param<UpdateP>("accountId")}
`;

export const selectOrdered = sql`
   SELECT ${row(Account.$$)}
   FROM ${Account}
   ${orderBy(Account, "sortField")}
`;

export const selectConditional = sql`
   SELECT ${row(Account.$$)}
   FROM ${Account}
   WHERE ${Account.$status} = ${param<ConditionalP>("status")}
   ${when("hasEmail", sql`AND ${Account.$email} = ${param<ConditionalP>("email")}`)}
`;
