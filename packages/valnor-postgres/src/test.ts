import { PgQueryHandler } from "./core/index.js";
import { sql } from "valnor/core";
import { Pool } from "pg";
import { Account, IAccountSelect } from "./core/__tests__/codegen/one_sql.account-table.js";

const query = sql<IAccountSelect>`SELECT ${Account.$$all} FROM ${Account} WHERE ${Account.status} = 'created' limit 100`;

const a = new PgQueryHandler(query);

const pool = new Pool({
   host: "localhost",
   user: "postgres",
   database: "postgres",
});

const res = await a.run(pool);
console.log(res);
