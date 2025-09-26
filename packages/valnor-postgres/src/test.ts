import { PostgresQueryHandler } from "./postgres-query-handler.js";
import { sql } from "valnor";
import { Pool } from "pg";
import { Account, IAccountSelect } from "./__tests__/codegen/one_sql.account-table.js";

const query = sql<IAccountSelect>`SELECT ${Account.$$all} FROM ${Account} WHERE ${Account.status} = 'created' limit 100`;

const a = new PostgresQueryHandler(query);

const pool = new Pool({
   host: "localhost",
   user: "postgres",
   database: "postgres",
});

const res = await a.run({ db: pool });
console.log(res);
