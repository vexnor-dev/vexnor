# CLI Reference

## `vexnor codegen`

Introspects a live database and generates TypeScript type files.

```bash
npx vexnor codegen [options]
```

### Options

| Option | Description | Required |
|--------|-------------|----------|
| `--plugin <name>` | Plugin package name (e.g. `@vexnor/postgres`) | yes (unless using `--profile`) |
| `--schema <name...>` | Database schema(s) to generate (repeatable) | yes (unless using `--profile`) |
| `--uri <connection>` | Connection URI (conflicts with individual host/port/etc) | one of `--uri` or host options |
| `--host <host>` | Database host | conflicts with `--uri` |
| `--port <port>` | Database port (default: `5432`) | conflicts with `--uri` |
| `--database <name>` | Database name | conflicts with `--uri` |
| `--user <username>` | Database user | conflicts with `--uri` |
| `--password <password>` | Database password | conflicts with `--uri` |
| `--outDir <path>` | Output directory for generated files | yes |
| `--camelCaseColumns` | Convert `snake_case` columns to `camelCase` | no |
| `--omit <tables...>` | Tables/views to exclude (supports `schema.table` format) | no |
| `-c, --config <path>` | Path to `vexnor.config.ts` (default: `vexnor.config.ts`) | no |
| `-p, --profile <profile>` | Profile to use from `vexnor.config.ts` | no |

### Examples

```bash
# Using connection URI
npx vexnor codegen \
  --plugin @vexnor/postgres \
  --schema public \
  --uri $DATABASE_URL \
  --outDir src/models \
  --camelCaseColumns

# Using individual connection options
npx vexnor codegen \
  --plugin @vexnor/postgres \
  --schema public \
  --host localhost \
  --port 5432 \
  --database mydb \
  --user admin \
  --password secret \
  --outDir src/models \
  --camelCaseColumns

# Multiple schemas
npx vexnor codegen \
  --plugin @vexnor/postgres \
  --schema public --schema billing \
  --uri $DATABASE_URL \
  --outDir src/models

# Exclude migration tables
npx vexnor codegen \
  --plugin @vexnor/postgres \
  --schema public \
  --uri $DATABASE_URL \
  --outDir src/models \
  --omit migration_history schema_version

# Exclude by schema.table
npx vexnor codegen \
  --plugin @vexnor/postgres \
  --schema public --schema internal \
  --uri $DATABASE_URL \
  --outDir src/models \
  --omit internal.audit_log

# Using a config profile
npx vexnor codegen --profile dev
```

### Generated Output

The output directory receives:

- One file per table: `<schema>.<table_name>-table.ts` — exports `SqlTable` instance and types
- One file per schema: `<schema>.schema.ts` — re-exports all tables in the schema
- Enum file (if enums exist): `<schema>-enums.ts`
- `index.ts` — barrel export

Table names are always PascalCased (`account` → `Account`).  
Column names respect `--camelCaseColumns` (`account_id` → `accountId` when enabled).

Each generated table includes:

- **`fk`** — foreign key relationships: `{ from: [...columns], to: { schema, table, columns } }`
- **`dbSchema`** — per-column database metadata: original `dbType`, mapped `type` (SqlLiteralType), optional `nullable`, `default`, and `values` (for enums)
- **`source`** — stable identifier (`packageName:relativeOutDir`) for the table registry

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

| Option | Description | Default |
|--------|-------------|---------|
| `-c, --config <path>` | Path to `vexnor.config.ts` | `vexnor.config.ts` |
| `-q, --query-config <path>` | Path to query config file (glob-matched) | required |
| `-e, --env <name>` | Parameter environment to use | — |
| `-f, --format <format>` | Output format: `table` \| `json` \| `csv` | `json` |
| `-l, --limit <number>` | Limit number of results | — |
| `-ctx, --context <key=value...>` | Context param values (repeatable) | — |
| `--dry-run` | Print SQL and params without executing | `false` |
| `--no-confirm` | Skip confirmation prompt for mutations | `false` |

### Examples

```bash
# Execute a query
npx vexnor exec run findActiveAccounts -q queries.vexnor.ts

# Use a named environment for params
npx vexnor exec run findAccountById -q queries.vexnor.ts --env prod

# Dry run — print SQL only
npx vexnor exec run findActiveAccounts -q queries.vexnor.ts --dry-run

# Output as table
npx vexnor exec run findActiveAccounts -q queries.vexnor.ts --format table

# Output as CSV
npx vexnor exec run findActiveAccounts -q queries.vexnor.ts --format csv

# Limit results
npx vexnor exec run findActiveAccounts -q queries.vexnor.ts --limit 5

# Provide context params (e.g. userId injected server-side in production)
npx vexnor exec run selectMyOrders -q queries.vexnor.ts --context userId=abc123

# Multiple context params
npx vexnor exec run selectMyOrders -q queries.vexnor.ts --context userId=abc123 --context tenantId=t-1

# Skip mutation confirmation
npx vexnor exec run deleteInactiveAccounts -q queries.vexnor.ts --no-confirm
```

### Query Type Detection & Confirmation

The CLI detects query types from SQL text:

- **Destructive** (`DROP`, `TRUNCATE`, `DELETE` without WHERE): prompts with `⚠️ DESTRUCTIVE operation!` if `confirmDestructive` is `true`
- **Mutation** (`INSERT`, `UPDATE`, `DELETE`): prompts if `confirmMutations` is `true`
- **Read** (`SELECT`): no confirmation needed

Use `--no-confirm` to skip all prompts (useful in scripts).

---

## Config Reference

### `vexnor.config.ts`

```typescript
import { defineConfig } from 'vexnor/config';

export default defineConfig({
  profiles: {
    dev: {
      connection: {
        host: process.env.POSTGRES_HOST,
        port: 5432,
        database: process.env.POSTGRES_DATABASE,
        user: process.env.POSTGRES_USER,
        password: process.env.POSTGRES_PASSWORD,
        // or: uri: process.env.DATABASE_URL
      },
      generate: {
        plugin: '@vexnor/postgres',
        schema: ['public'],
        outDir: 'src/models',
        pascalCaseTables: true,
        camelCaseColumns: true,
      },
    },
    prod: {
      connection: {
        uri: process.env.DATABASE_URL,
      },
      generate: {
        plugin: '@vexnor/postgres',
        schema: ['public'],
        outDir: 'src/models',
        camelCaseColumns: true,
      },
    },
  },
  defaultProfile: 'dev',
  exec: {
    format: 'table',
    confirmMutations: true,
    confirmDestructive: true,
    dryRun: false,
    limit: undefined,
  },
});
```

### Config Types

```typescript
interface VexnorConfig {
  profiles: Record<string, ProfileConfig>;
  defaultProfile?: string;
  exec?: ExecConfig;
}

interface ProfileConfig {
  connection: ConnectionConfig;
  generate?: GenerateConfig;
}

interface GenerateConfig {
  plugin?: string;
  schema: string[];
  outDir: string;
  pascalCaseTables?: boolean;
  camelCaseColumns?: boolean;
}

interface ExecConfig {
  format?: 'table' | 'json' | 'csv';
  limit?: number;
  confirmMutations?: boolean;
  confirmDestructive?: boolean;
  dryRun?: boolean;
}
```

### Connection Config

Either URI-based or individual fields:

```typescript
// URI
{ uri: 'postgres://user:pass@host:5432/database' }

// Individual fields
{ host: 'localhost', port: 5432, database: 'mydb', user: 'admin', password: 'secret' }
```

---

### Query Config (`queries.vexnor.ts`)

Define execution settings per query. The CLI uses `defineQueryConfig()` for type safety:

```typescript
import { defineQueryConfig } from 'vexnor/config';
import { findActiveAccounts, findAccountById } from './queries.js';
import vexnorPostgres from '@vexnor/postgres';

export default defineQueryConfig({ findActiveAccounts, findAccountById })({
  queries: {
    findActiveAccounts: {
      plugin: vexnorPostgres,
      profile: 'dev',
      params: {},
      format: 'table',
      environments: {
        dev: {},
        prod: {},
      },
    },
    findAccountById: {
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

#### `defineQueryConfig(queries)(config)` — Two-step call

1. Pass the query objects — this infers parameter types
2. Pass the config — TypeScript validates that `params` match the query's declared parameters

If a query uses `ctx()` parameters (runtime-injected values), use `contextValue` as a placeholder and provide the real value via `--context`:

```typescript
import { contextValue } from 'vexnor';

export default defineQueryConfig({ selectMyOrders })({
  queries: {
    selectMyOrders: {
      plugin: vexnorPostgres,
      profile: 'dev',
      params: { userId: contextValue }, // provided via --context userId=...
    },
  },
});
```

---

## Cross-Reference

- [Quickstart](quickstart.md) — full onboarding using CLI
- [Databases](databases.md) — driver-specific connection setup
