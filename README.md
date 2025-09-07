# sql-typecraft

A powerful SQL query generator that creates type-safe mappings from database schemas to TypeScript,
enabling type-safe SQL queries.

[![CI](https://github.com/atopala/pg-typecraft/actions/workflows/ci_github.yml/badge.svg)](https://github.com/atopala/pg-typecraft/actions/workflows/ci_github.yml)

## Quick Links

📖 **[Complete Documentation Wiki](wiki/Home.md)**

- [Installation](wiki/Installation.md) | [Usage](wiki/Usage.md) | [Examples](wiki/Type-Safe-Query-Examples.md)
- [Subqueries](wiki/Subqueries.md) | [Features](wiki/Features.md) | [postgres.js Setup](wiki/postgres.js.md) | [CI/CD Integration](wiki/CI-CD-Integration.md)

## Quickstart

**1. Generate TypeScript types from your database:**
```bash
npx sql-typecraft generate --schema your_schema --uri $POSTGRES_URI --outDir 'src/codegen'
```

**2. Write type-safe SQL queries:**

```typescript
import {OneSqlSchema} from "./codegen/one_sql.schema.ts";
import {IAccountSelect} from "./one_sql.account-table";
import {AccountStatusUdt} from "./one_sql-enums";
import {sql, param} from "one-sql";

// pg
const db = new Pool({
    host: "localhost",
    user: "postgres",
    database: "postgres",
});

// Type-safe insert with auto-completion
const newAccount = await sql<IAccountSelect>`
    INSERT INTO ${Account}
        ${Account.$values({
    firstName: "John",
    lastName: "Doe",
    email: "john@example.com"
})}
    RETURNING ${Account.$all}
`.one(db);

// build a function that finds an account by 'accountId'.
// this improves performance since the sql query gets re-used by following calls to db
const findAccountById = sql<IAccountSelect, { accountId: number }>`
    SELECT ${Account.$all}
    FROM ${Account}
    WHERE ${Account.accountId} = ${param("accountId")}
`
const account = await findAccountById.one(db, { accountId: newAccount.accountId });
```

> 📖 **[See complete examples in the wiki](wiki/Quickstart.md)**

## Key Features

✅ **Type-safe SQL queries** - Full TypeScript support & code generation for SQL tables, views, columns and sub-queries with auto-completion  
✅ **Multiple drivers** - Works with `pg` and `postgres.js`  
✅ **Smart naming** - Automatic snake_case ↔ camelCase conversion  
✅ **Multiple schemas** - Generate from multiple database schemas  
✅ **CI/CD ready** - Integrate into your build pipeline

Next releases planned to support `mssql`, `mysql`, sqlite, etc.

> 📖 **[View all features](wiki/Features.md)** 

## Installation

```bash
# Install as dev dependency
npm install sql-typecraft --save-dev

# Or use directly with npx
npx sql-typecraft generate --schema your_schema --uri $POSTGRES_URI --outDir 'src/codegen'
```

> 📖 **[Installation guide with all options](wiki/Installation.md)**

## Usage

```bash
sql-typecraft generate --schema your_schema --uri $POSTGRES_URI --outDir 'src/codegen'
```

**Common options:**
- `--schema` - db schema name. Possible to include multiple schemas: `--schema schema1 --schema schema2 ...` 
- `--driver` - db driver: `pg`, `postgres.js`
- `--pascalCaseTables` - PascalCase table names
- `--camelCaseColumns` - camelCase column names

Next releases planned to support `mssql`, `mysql`, sqlite, etc.

> 📖 **[Complete usage guide](wiki/Usage.md)**


## Documentation

📖 **[Complete Wiki Documentation](wiki/Home.md)**

- **[Quickstart Guide](wiki/Quickstart.md)** - Get up and running quickly
- **[Type-Safe Query Examples](wiki/Type-Safe-Query-Examples.md)** - Insert, select, update examples
- **[Subqueries](wiki/Subqueries.md)** - Build reusable, type-safe query components
- **[postgres.js Setup](wiki/postgres.js.md)** - Using postgres.js driver
- **[CI/CD Integration](wiki/CI-CD-Integration.md)** - Automate type generation


## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

> 📖 **[Contributing Guidelines](wiki/Contributing.md)**

## License

MIT