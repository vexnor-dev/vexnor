# CLI Reference

## `vexnor codegen`

Introspects a live database and generates TypeScript type files.

```bash
npx vexnor codegen [options]
```

### Options

| Option | Description |
|--------|-------------|
| `--plugin <name>` | Plugin package name (required) |
| `--schema <name>` | Database schema (repeatable) |
| `--uri <connection>` | Connection URI |
| `--host <host>` | |
| `--port <port>` | |
| `--database <name>` | |
| `--user <username>` | |
| `--password <password>` | |
| `--outDir <path>` | Output directory for generated files (required) |
| `--pascalCaseTables` | `account` → `Account` |
| `--camelCaseColumns` | `account_id` → `accountId` |
| `--omit <tables...>` | Tables/views to exclude |

### Example

```bash
npx vexnor codegen \
  --plugin vexnor-postgres \
  --schema public \
  --uri $DATABASE_URL \
  --outDir src/models \
  --pascalCaseTables \
  --camelCaseColumns
```

### Using a Config File

Define connection and codegen options in `vexnor.config.ts` and run codegen via profile:

```bash
npx vexnor codegen --profile dev
```

See [Config Reference](#config-reference) below.

---

## `vexnor exec init`

Scaffolds `vexnor.config.ts` and a starter `queries.vexnor.ts` in the current directory.

```bash
npx vexnor exec init
```

| Option | Description |
|--------|-------------|
| `--force` | Overwrite existing files |

---

## `vexnor exec run`

Executes a named query defined in a query config file.

```bash
npx vexnor exec run <query> [options]
```

### Options

| Option | Description |
|--------|-------------|
| `-c, --config <path>` | Path to `vexnor.config.ts` (default: `vexnor.config.ts`) |
| `-q, --query-config <path>` | Path to query config file (required) |
| `-e, --env <name>` | Parameter environment to use |
| `-f, --format <format>` | Output format: `table` \| `json` \| `csv` (default: `json`) |
| `-l, --limit <number>` | Limit number of results |
| `--dry-run` | Print SQL and params without executing |
| `--no-confirm` | Skip confirmation prompt for mutations |

### Example

```bash
# Execute a query
npx vexnor exec run findActiveAccounts -q queries.vexnor.ts

# Use a named environment for params
npx vexnor exec run findAccountById -q queries.vexnor.ts --env prod

# Dry run — print SQL only
npx vexnor exec run findActiveAccounts -q queries.vexnor.ts --dry-run

# Output as CSV
npx vexnor exec run findActiveAccounts -q queries.vexnor.ts --format csv
```

---

## Config Reference

### `vexnor.config.ts`

```typescript
import { defineConfig } from 'vexnor';

export default defineConfig({
  profiles: {
    dev: {
      plugin: 'vexnor-postgres',
      connection: {
        host: process.env.POSTGRES_HOST,
        port: 5432,
        database: process.env.POSTGRES_DATABASE,
        user: process.env.POSTGRES_USER,
        password: process.env.POSTGRES_PASSWORD,
        // or: uri: process.env.DATABASE_URL
      },
      generate: {
        schemas: ['public'],
        outDir: 'src/models',
        pascalCaseTables: true,
        camelCaseColumns: true,
      },
    },
  },
  defaultProfile: 'dev',
  exec: {
    format: 'table',
    confirmMutations: true,
    confirmDestructive: true,
  },
});
```

### Query Config (`queries.vexnor.ts`)

Co-locate a `.vexnor.ts` file alongside your query file to define execution settings per query.

```typescript
import { defineQueryConfig } from 'vexnor';
import { findActiveAccounts, findAccountById } from './queries.js';
import vexnorPostgres from 'vexnor-postgres';

export default defineQueryConfig({
  queries: {
    findActiveAccounts: {
      query: findActiveAccounts,
      plugin: vexnorPostgres,
      profile: 'dev',
      format: 'table',
      environments: {
        dev: {},
        prod: {},
      },
    },
    findAccountById: {
      query: findAccountById,
      plugin: vexnorPostgres,
      profile: 'dev',
      params: { accountId: '00000000-0000-0000-0000-000000000001' },
      environments: {
        dev: { accountId: '00000000-0000-0000-0000-000000000001' },
        prod: { accountId: '00000000-0000-0000-0000-000000000002' },
      },
    },
  },
});
```
