# Quickstart

> code sample from the example at: https://github.com/atopala/valnor

Generate the code from existing postgres db schema `one_sql`.
```bash
npx valnor generate --cli one_sql --uri $POSTGRES_URI --outDir 'src/codegen'

# It's possible to include more schemas!
npx valnor generate --cli one_sql1 --cli one_sql2 --uri $POSTGRES_URI --outDir 'src/codegen'
```

```typescript 
import {OneSqlSchema} from "./codegen/one_sql.cli.ts";
import {IAccountSelect} from "./one_sql.account-table";
import {AccountStatusUdt} from "./one_sql-enums";
import {sql, param} from "one-sql";

// postgres
const db = new Pool({
    host: "localhost",
    user: "postgres",
    database: "postgres",
});

// create the respective table(s) from your cli using existing postgres connection "sql"
const {Account, Order} = OneSqlSchema;

{
    // write strongly type SQL to insert a new record into "Account" table using helper functions 
    const newAccount = await sql<IAccountSelect>`
    INSERT INTO ${Account}
        ${Account.$values({
        firstName: "John",
        lastName: "Doe",
        email: "john@example.com",
        status: AccountStatusUdt.CREATED
    })}
    RETURNING ${Account.$$all}`.one(pool);

    // retrieve the inserted account
    const account = await sql<IAccountSelect>`
    SELECT ${Account.$$all}
    FROM ${Account}
    WHERE ${Account.accountId} = ${newAccount.accountId}`.one(db);
}

{
    // or create a parametrized query to fetch the account by id
    const findAccountById = sql<IAccountSelect, { accountId: string }>`
    SELECT ${Account.$$all}
    FROM ${Account}
    WHERE ${Account.accountId} = ${param("accountId")}
`;

    const account = await findAccountById.one(db, {accountId: 101});
}

{
    // update the account
    const updateAccountStatusById = sql<IAccountSelect, { accountId: string; status: AccountStatusUdt }>`
    UPDATE ${Account}
    SET ${Account.$set({
        status: param("status")
    })}
    WHERE ${Account.accountId} = ${param("accountId")}
    RETURNING ${Account.$$all}
`
    const account = await updateAccountStatusById.run(db, {accountId: 101, status: AccountStatusUdt});
}
```