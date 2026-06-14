import { row, sql } from "vexnor";
import { Account } from "./codegen/vexnor_dev.account-table.js";
import { pool } from "./mssql-pool.js";
import "vexnor-mssql";

await pool.connect();

const data = await sql`
    select top 2 ${row(Account.$$)}
    from ${Account}
`.mssql.run({ db: pool.request() });

console.log(JSON.stringify(data));
await pool.close();
