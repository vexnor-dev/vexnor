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

## `vexnor schema select`

Reviews the objects discovered for one datasource profile and persists the objects that local tools may expose. Selections are stored in `vexnor.local.json` by default.

```bash
npx vexnor schema select [options]
```

### Options

| Option | Description |
|--------|-------------|
| `-c, --config <path>` | Path to `vexnor.config.ts` (default: `vexnor.config.ts`) |
| `-p, --profile <profile>` | Profile to use; defaults to `defaultProfile` |
| `--selection-config <path>` | Override the local selection config path |
| `--include <objects...>` | Select only these schema-qualified objects |
| `--exclude <objects...>` | Exclude these schema-qualified objects |
| `--all` | Select every discovered object |
| `--save` | Persist a non-interactive selection override |

Run without `--include`, `--exclude`, or `--all` to review the selection in an interactive checkbox list:

- use the up/down arrow keys to navigate and Space to toggle an object;
- press `/` to enter a case-insensitive text filter, Enter to apply it, and Escape to clear it;
- press Tab to cycle through all, checked, and unchecked objects;
- press `a` to select or deselect every object visible under the active filters;
- press Enter to save the complete selection, including objects hidden by filters, or Escape to cancel.

For automation, provide an explicit selection and `--save`:

```bash
npx vexnor schema select --profile dev --include public.account public.order --save
```

When the live schema changes, run the command again to review reconciled additions, removals, and changes before exposing them.

---

## `vexnor schema mcp`

Starts a local stdio MCP server for a persisted datasource selection. The command does not listen on a network port and does not expose a tool unless it is named explicitly in `--tools`.

```bash
npx vexnor schema mcp --profile dev --tools getSchema join
```

Run `vexnor schema select` for the profile first. Startup fails closed if the profile has no persisted selection or the selection no longer reconciles safely with the live catalog.

### Options

| Option | Description | Default |
|--------|-------------|---------|
| `-c, --config <path>` | Path to `vexnor.config.ts` | `vexnor.config.ts` |
| `-p, --profile <profile>` | Profile to use; defaults to `defaultProfile` | — |
| `--selection-config <path>` | Override the local selection config path | `vexnor.local.json` beside the config |
| `--tools <tools...>` | Explicit enabled tools: `getSchema`, `join`, `fetchData` | required |
| `--max-rows <number>` | Database-side maximum rows returned by one fetch | `100` |
| `--timeout-ms <number>` | Maximum query execution time in milliseconds | `30000` |
| `--max-concurrency <number>` | Maximum concurrent local queries | `1` |

`getSchema` exposes only selected metadata. `join` registers structured read-only queries through known selected relationships. `fetchData` executes only an opaque query hash already registered by the session; it never accepts SQL. Enable `fetchData` only when the MCP client needs row access:

```bash
# Metadata and query construction only
npx vexnor schema mcp --profile dev --tools getSchema join

# Metadata, query construction, and bounded row access
npx vexnor schema mcp \
  --profile dev \
  --tools getSchema join fetchData \
  --max-rows 50 \
  --timeout-ms 10000 \
  --max-concurrency 1
```

Use a read-only database account for the profile. Do not put credentials in MCP arguments or prompts; keep them in the profile's environment-backed connection config. Stopping the client, pressing Ctrl-C, or sending SIGTERM closes the MCP transport and datasource connection.

### Codex

Codex can launch the local CLI directly. This one-shot form leaves the user's persistent Codex MCP configuration unchanged:

```bash
codex exec --ignore-user-config \
  -c 'mcp_servers.vexnor.command="npx"' \
  -c 'mcp_servers.vexnor.args=["vexnor","schema","mcp","--profile","dev","--tools","getSchema","join"]' \
  'Use the vexnor tools to summarize the selected schema.'
```

Add `fetchData` to the MCP arguments only when the task needs bounded local row access.

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

## `vexnor serialize`

Converts TypeScript query definitions into portable JSON manifests for cross-runtime execution (e.g., .NET, AI agents). Each source file maps to its own manifest JSON.

```bash
npx vexnor serialize [options]
```

### Options

| Option | Description | Required |
|--------|-------------|----------|
| `-i, --input <glob>` | Glob pattern for files exporting queries | yes |
| `-o, --output <dir>` | Output directory for manifest JSON files | yes |
| `-d, --dialect <dialect>` | SQL dialect: `postgresql`, `transactsql`, `sqlite` | yes |

### Example

```bash
npx vexnor serialize \
  --input "src/queries/**/*.ts" \
  --output manifests/ \
  --dialect postgresql
```

See [Serialize](serialize.md) for the full manifest format, schema manifest API, and workflow details.

---

## Config Reference

### `vexnor.config.ts`

```typescript
import { defineConfig } from '@vexnor/core/config';

export default defineConfig({
  profiles: {
    dev: {
      plugin: '@vexnor/postgres',
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
      plugin: '@vexnor/postgres',
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
  plugin?: string;
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
import { defineQueryConfig } from '@vexnor/core/config';
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
import { contextValue } from '@vexnor/core';

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
