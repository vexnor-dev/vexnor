# Valnor Exec Feature Specifications

## Overview

A CLI command to execute valnor SQL queries defined in TypeScript code, with support for parameter injection, multiple output formats, and flexible configuration.

## Command Structure

```bash
valnor exec [options]
```

## Core Features

### 1. Query Input Methods

#### File Input (V1)
```bash
valnor exec --file queries/find-accounts.ts --query findAccountById
valnor exec -f queries/find-accounts.ts --query findAccountById
```

### 2. Query Execution Rules

- **Query Selection**: Developer must specify query name via `--query <name>` flag
- **Root Query Only**: If code contains subqueries, only execute the root/final query
- **V2 Enhancement**: Automatic query detection and interactive selection for multiple root queries

**Example:**
```typescript
// Subquery (not executed)
const AccountsWithEmail = sql`
  ${info({ label: "AccountsWithEmail" })}
  select ${row(Account.$$)}
  from ${Account}
  where ${Account.$email} = ${param("email").is<string>()}
`;

// Root query (this gets executed)
const findAccountByEmail = sql`
  select ${row(AccountsWithEmail.$$)}
  from ${AccountsWithEmail}
  where ${AccountsWithEmail.$firstName} = ${param("firstName").is<string>()}
`;
```

### 3. Configuration System

#### Priority Order (Highest to Lowest)
1. CLI flags
2. Query-specific config in `{filename}.valnor.ts`
3. File defaults in `{filename}.valnor.ts`
4. Root config (`valnor.config.ts`)
5. Interactive prompt (fallback)

#### Root Config: `valnor.config.ts`

Search order: `valnor.config.ts` → `valnor.config.mjs` → `valnor.config.js`

```typescript
import { defineConfig } from 'valnor';

export default defineConfig({
  // Profiles: self-contained DB configurations
  profiles: {
    postgres: {
      plugin: 'valnor-postgres', // Package name, loads default export
      connection: {
        host: process.env.POSTGRES_HOST,
        port: process.env.POSTGRES_PORT,
        database: process.env.POSTGRES_DATABASE,
        user: process.env.POSTGRES_USER,
        password: process.env.POSTGRES_PASSWORD,
        // Or: uri: process.env.DATABASE_URL
      },
      generate: {
        schema: ['valnor_test'],
        outDir: './src/codegen/postgres',
        pascalCaseTables: true,
        camelCaseColumns: true,
      },
    },
    
    mysql: {
      plugin: 'valnor-mysql',
      connection: {
        host: process.env.MYSQL_HOST,
        port: process.env.MYSQL_PORT,
        database: process.env.MYSQL_DATABASE,
        user: process.env.MYSQL_USER,
        password: process.env.MYSQL_PASSWORD,
      },
      generate: {
        schema: ['public'],
        outDir: './src/codegen/mysql',
        pascalCaseTables: true,
        camelCaseColumns: false,
      },
    },
  },
  
  // Default profile (optional)
  defaultProfile: 'postgres',
  
  // Global query execution settings
  exec: {
    format: 'table', // 'json' | 'csv' | 'table'
    limit: 100, // auto-limit for SELECT queries
    confirmMutations: true, // prompt before INSERT/UPDATE/DELETE
    dryRun: false,
  },
});
```

#### File-Specific Config: `{filename}.valnor.ts`

Co-located with query file:
```
queries/
  ├── find-accounts.ts
  ├── find-accounts.valnor.ts
```

**find-accounts.valnor.ts:**
```typescript
import { defineQueryConfig } from 'valnor';

export default defineQueryConfig({
  // Per-query configuration
  queries: {
    findAccountById: {
      profile: 'postgres', // References root config profile
      params: { accountId: 1 },
      environments: {
        dev: { accountId: 1 },
        staging: { accountId: 50 },
        prod: { accountId: 100 },
      },
    },
    
    findUserInMysql: {
      profile: 'mysql', // Different profile for this query
      params: { userId: 1 },
      environments: {
        dev: { userId: 1 },
        prod: { userId: 999 },
      },
    },
  },
  
  // Default settings for all queries in this file
  defaults: {
    profile: 'postgres',
    format: 'json',
    limit: 50,
  },
});
```

**Usage:**
```bash
# Uses query-specific config
valnor exec --file find-accounts.ts --query findAccountById

# Uses 'dev' environment
valnor exec --file find-accounts.ts --query findAccountById --env dev

# Override profile
valnor exec --file find-accounts.ts --query findAccountById --profile mysql
```

### 4. Parameter Handling

#### Detection
- Use `SqlQuery.params` property (similar to `SqlQuery.row`) to identify required params at runtime
- `SqlQuery.params` is a `Record<string, SqlParam>` containing param metadata
- Each `SqlParam` includes: name, type, and optional metadata

**Example:**
```typescript
const query = sql`
  select ${row(Account.$$)}
  from ${Account}
  where ${Account.$email} = ${param("email").is<string>()}
    and ${Account.$accountId} = ${param("accountId").is<number>()}
`;

// Access params metadata
console.log(query.params);
// {
//   email: { name: 'email', type: 'string' },
//   accountId: { name: 'accountId', type: 'number' }
// }
```

#### Interactive Prompts
If params are not provided via config/flags:
```
Parameter 'email' (string): _
Parameter 'firstName' (string): _
Parameter 'tags' (array, comma-separated): _
```

#### CLI Param Override
```bash
valnor exec --file query.ts --query findAccountById --param email=test@example.com --param firstName=John
valnor exec -f query.ts --query findAccountById -p email=test@example.com -p firstName=John

# Array params (comma-separated)
valnor exec -f query.ts --query findAccountById -p tags=tag1,tag2,tag3
```

#### Inline Params (JSON)
```bash
valnor exec --file query.ts --query findAccountById --params '{"email":"test@example.com","firstName":"John"}'
```

### 5. Output Formats

#### Table Format (Default)
```
┌──────────┬────────────┬─────────────────────┐
│ id       │ firstName  │ email               │
├──────────┼────────────┼─────────────────────┤
│ 1        │ John       │ john@example.com    │
│ 2        │ Jane       │ jane@example.com    │
└──────────┴────────────┴─────────────────────┘

Rows: 2
```

#### JSON Format
```bash
valnor exec --file query.ts --query findAccountById --format json
```
```json
[
  {"id": 1, "firstName": "John", "email": "john@example.com"},
  {"id": 2, "firstName": "Jane", "email": "jane@example.com"}
]
```

#### CSV Format
```bash
valnor exec --file query.ts --query findAccountById --format csv
```
```csv
id,firstName,email
1,John,john@example.com
2,Jane,jane@example.com
```

#### Output to File
```bash
valnor exec --file query.ts --query findAccountById --format json --output results.json
valnor exec -f query.ts --query findAccountById -o results.json
```

### 6. SQL Display

Always show generated SQL before execution:

```
Generated SQL:
──────────────────────────────────────────────────
select "AccountsWithEmail".*
from (/* --label: AccountsWithEmail */ 
      select "a_1"."account_id" as "accountId",
             "a_1"."email",
             "a_1"."first_name" as "firstName"
      from "valnor_test"."account" as "a_1"
      where "a_1"."email" = $1
     ) as "AccountsWithEmail"
where "AccountsWithEmail"."firstName" = $2
──────────────────────────────────────────────────
Parameters: ["test@example.com", "John"]

Executing...
```

### 7. Safety Features

#### Dry Run
```bash
valnor exec --file query.ts --query findAccountById --dry-run
# Shows SQL and params, but doesn't execute
```

#### SQL Only
```bash
valnor exec --file query.ts --query findAccountById --sql-only
# Shows generated SQL without params or execution
```

#### Mutation Confirmation (V2)
For INSERT/UPDATE/DELETE queries, prompt for confirmation:
```
⚠️  This query will modify data (UPDATE)
Generated SQL: UPDATE "account" SET ...
Continue? (y/N): _
```

Disable with:
```bash
valnor exec --file query.ts --query updateAccount --no-confirm
```

Or in config:
```typescript
exec: {
  confirmMutations: false,
}
```

#### Auto-Limit (V2)
Automatically add LIMIT clause to SELECT queries without one:
```typescript
exec: {
  limit: 100, // default limit
}
```

Disable with:
```bash
valnor exec --file query.ts --query findAccounts --no-limit
```

### 8. Query Explain (V2)
```bash
valnor exec --file query.ts --query findAccountById --explain
# Shows query execution plan
```

### 9. Config File Generation (V1)

Generate query config files automatically from query files.

```bash
valnor exec init --file queries/find-accounts.ts
```

**What it does:**
1. Scans the query file for all exported `sql` queries
2. Extracts query names and parameters using `SqlQuery.params`
3. Generates `{filename}.valnor.ts` with scaffolded config
4. Includes all queries with default param values based on types

**Generated config example:**
```typescript
// Auto-generated from find-accounts.ts
import { defineQueryConfig } from 'valnor';

export default defineQueryConfig({
  queries: {
    findAccountById: {
      profile: 'postgres', // from defaultProfile
      params: {
        accountId: 0, // default for number
      },
      environments: {
        dev: { accountId: 0 },
        prod: { accountId: 0 },
      },
    },
    findAccountByEmail: {
      profile: 'postgres',
      params: {
        email: '', // default for string
      },
      environments: {
        dev: { email: '' },
        prod: { email: '' },
      },
    },
  },
  defaults: {
    profile: 'postgres',
    format: 'table',
  },
});
```

**Options:**
```bash
# Generate config for specific file
valnor exec init --file queries/find-accounts.ts

# Specify profile
valnor exec init --file queries/find-accounts.ts --profile mysql

# Add specific environments
valnor exec init --file queries/find-accounts.ts --env dev,staging,prod

# Overwrite existing config
valnor exec init --file queries/find-accounts.ts --force
```

**Interactive mode:**
```bash
$ valnor exec init --file queries/find-accounts.ts

Found 2 queries in find-accounts.ts:
  - findAccountById (params: accountId)
  - findAccountByEmail (params: email)

Default profile? (postgres): postgres
Environments? (dev,prod): dev,staging,prod
Default format? (table): json

Generating find-accounts.valnor.ts...
✓ Config file created successfully
```

## CLI Options Reference

### Connection Options
- `--profile <name>` - Profile to use from root config (default: defaultProfile)
- `--config <path>` - Path to config file (default: auto-detect)
- Connection params can override profile settings: `--host`, `--port`, `--database`, `--user`, `--password`

### Input Options
- `--file, -f <path>` - Path to query file (required for v1)
- `--query <name>` - Query name to execute (required for exec)

### Config Generation Options (exec init)
- `--file, -f <path>` - Path to query file to generate config for (required)
- `--profile <name>` - Default profile for queries (default: from root config)
- `--env <list>` - Comma-separated list of environments (default: dev,prod)
- `--force` - Overwrite existing config file

### Parameter Options
- `--param, -p <key=value>` - Set individual param (repeatable)
- `--params <json>` - Set all params as JSON object
- `--env <name>` - Use named environment from file config

### Output Options
- `--format <table|json|csv>` - Output format (default: table)
- `--output, -o <path>` - Write output to file
- `--sql-only` - Show SQL without executing
- `--explain` - Show query execution plan (V2)

### Execution Options
- `--dry-run` - Show SQL and params without executing
- `--no-confirm` - Skip mutation confirmation (V2)
- `--no-limit` - Disable auto-limit for SELECT (V2)
- `--limit <number>` - Override auto-limit value (V2)

## Implementation Notes

### Plugin Spy/Mock Approach
1. Load root config and resolve profile
2. Load plugin by package name: `require('valnor-postgres')` or `import('valnor-postgres')`
3. Create spy/proxy wrapper around plugin to intercept execution methods
4. Inject spy into global scope or module system
5. Dynamic import query file (executes naturally, including `.getAll()` calls)
6. Spy captures: query object, SQL, params, execution method
7. Use `query.params` to get param metadata for interactive prompts
8. Display SQL and params to user
9. Execute via real plugin if not dry-run
10. Format and display results

**Benefits:**
- No parsing needed - code executes naturally
- Handles any query pattern, including immediate execution
- Spy intercepts plugin methods (getAll, getOne, execute, etc.)
- `SqlQuery.params` provides clean param introspection

### SqlQuery.params Property

**Type Definition:**
```typescript
interface SqlParam {
  name: string;
  type: string; // 'string' | 'number' | 'boolean' | 'array' | etc.
  // Optional metadata
  required?: boolean;
  default?: any;
}

interface SqlQuery<TRow, TParams> {
  readonly params: Record<keyof TParams, SqlParam>;
  readonly row: TRow;
  getSql(params: TParams): string;
  getValues(params: TParams): any[];
  // ... other methods
}
```

**Usage in valnor exec:**
```typescript
// Get param metadata
const paramMetadata = query.params;

// Prompt for missing params
for (const [name, param] of Object.entries(paramMetadata)) {
  if (!providedParams[name]) {
    const value = await prompt(`Parameter '${name}' (${param.type}): `);
    providedParams[name] = parseParamValue(value, param.type);
  }
}
```ult export (or named export if specified: `valnor-postgres#PostgresPlugin`)
4. Plugin provides:
   - `generate()` - Schema introspection & code generation
   - `execute()` - Query execution against DB

### Query Loading (No Parsing Needed)
1. Use dynamic import to load query file: `await import(filePath)`
2. Access query by name: `module[queryName]`
3. Validate it's a SqlQuery object: `typeof query.getSql === 'function'`
4. Subqueries are automatically handled by valnor's sql function

### Parameter Extraction
1. Use `SqlQuery.params` property to identify required params (no parsing needed)
2. Get param metadata: `query.params` returns `Record<string, SqlParam>`
3. Merge params from all sources (CLI → query config → file defaults → interactive)

### Execution Flow
1. Load root config (`valnor.config.ts`)
2. Load file-specific config (`{filename}.valnor.ts`)
3. Resolve profile (CLI → query config → file defaults → root default)
4. Load plugin from profile and create spy wrapper
5. Inject spy globally
6. Dynamic import query file (executes naturally)
7. Access query by name from module exports
8. Collect params using `query.params` (CLI → query config → file defaults → interactive)
9. Spy captures SQL, params, and execution method
10. Display SQL and params
11. Confirm if mutation (if enabled, V2)
12. Execute query via real plugin
13. Format and display results

### Error Handling
- Invalid TypeScript code → show parse error
- No query found → show error with guidance
- Missing params → prompt interactively
- Connection error → show connection details
- Query error → show SQL and error message
- Profile not found → show available profiles

## Examples

### Example 1: Basic Execution
```bash
$ valnor exec --file queries/find-accounts.ts --query findAccountByEmail

Parameter 'email' (string): john@example.com

Generated SQL:
──────────────────────────────────────────────────
select "a_1"."account_id" as "accountId",
       "a_1"."email"
from "valnor_test"."account" as "a_1"
where "a_1"."email" = $1
──────────────────────────────────────────────────
Parameters: ["john@example.com"]

Executing...

┌──────────┬─────────────────────┐
│ id       │ email               │
├──────────┼─────────────────────┤
│ 1        │ john@example.com    │
└──────────┴─────────────────────┘

Rows: 1
```

### Example 2: Using Environment
```bash
$ valnor exec --file queries/find-accounts.ts --query findAccountById --env prod

# Uses params from 'prod' environment in find-accounts.valnor.ts
Generated SQL: ...
Executing...
Results: ...
```

### Example 3: Override Params
```bash
$ valnor exec --file queries/find-accounts.ts --query findAccountById --param accountId=999
```

### Example 4: Dry Run
```bash
$ valnor exec --file queries/update-account.ts --query updateAccountStatus --dry-run

Generated SQL:
──────────────────────────────────────────────────
UPDATE "account" SET "status" = $1 WHERE "id" = $2
──────────────────────────────────────────────────
Parameters: ["ACTIVE", 123]

[Dry run - query not executed]
```

### Example 5: JSON Output to File
```bash
$ valnor exec --file queries/find-accounts.ts --query findAccountById --format json --output results.json

Generated SQL: ...
Executing...
Results written to: results.json
```

### Example 6: Generate Query Config
```bash
$ valnor exec init --file queries/find-accounts.ts

Found 2 queries in find-accounts.ts:
  - findAccountById (params: accountId)
  - findAccountByEmail (params: email)

Default profile? (postgres): postgres
Environments? (dev,prod): dev,staging,prod

Generating find-accounts.valnor.ts...
✓ Config file created successfully
```

### Example 7: Generate with Profile
```bash
$ valnor generate --profile postgres
# Uses postgres profile: plugin, connection, and generate options

$ valnor generate --profile mysql
# Uses mysql profile with its own settings

$ valnor generate
# Uses defaultProfile (postgres)
```

## V1 Scope

**Included:**
- ✅ Profile-based configuration
- ✅ `--query <name>` flag (required)
- ✅ `--file` input
- ✅ File-specific config with per-query settings
- ✅ Config file generation (`valnor exec init`)
- ✅ Environment support
- ✅ CLI param overrides
- ✅ Table/JSON/CSV output (using cli-table3)
- ✅ Basic safety (dry-run, sql-only)
- ✅ Plugin loading by package name
- ✅ Plugin spy/mock for natural code execution

**Deferred to V2:**
- ❌ Automatic query detection
- ❌ Interactive mode (paste query)
- ❌ Stdin input
- ❌ Auto-limit for SELECT
- ❌ Mutation confirmation
- ❌ Query explain

## Future Enhancements (V3+)

- **Watch mode**: `--watch` to re-execute on file changes
- **Multiple queries**: Execute multiple queries in sequence
- **Transaction support**: Wrap multiple queries in transaction
- **Query templates**: Reusable query templates with placeholders
- **Result caching**: Cache results for repeated queries
- **Performance metrics**: Show execution time, rows affected
- **Advanced plugins**: Custom formatters, transformers, validators

## Implementation Guide

### Package Structure

```
packages/valnor/
├── src/
│   ├── cli/
│   │   ├── exec/
│   │   │   ├── index.ts              # Main exec command handler
│   │   │   ├── init.ts               # Config generation (exec init)
│   │   │   ├── config-loader.ts      # Load & merge configs
│   │   │   ├── plugin-spy.ts         # Plugin proxy/spy wrapper
│   │   │   ├── param-collector.ts    # Collect & prompt for params
│   │   │   ├── formatters/
│   │   │   │   ├── table.ts          # Table formatter
│   │   │   │   ├── json.ts           # JSON formatter
│   │   │   │   └── csv.ts            # CSV formatter
│   │   │   └── utils.ts              # Shared utilities
│   │   ├── generate/                 # Existing codegen
│   │   └── cli.ts                    # CLI entry point
│   ├── config/
│   │   ├── define-config.ts          # defineConfig() helper
│   │   ├── define-query-config.ts    # defineQueryConfig() helper
│   │   └── types.ts                  # Config type definitions
│   └── core/                         # Existing sql runtime
│       └── sql.ts                    # Add SqlQuery.params property here
```

### Dependencies

**New dependencies to add:**
```json
{
  "dependencies": {
    "cli-table3": "^0.6.3",
    "prompts": "^2.4.2"
  }
}
```

**Existing dependencies (already available):**
- `commander` - CLI argument parsing
- `chalk` - Terminal colors
- Dynamic import support (Node.js built-in)

### Type Definitions

```typescript
// config/types.ts

export interface ValnorConfig {
  profiles: Record<string, ProfileConfig>;
  defaultProfile?: string;
  exec?: ExecConfig;
}

export interface ProfileConfig {
  plugin: string; // Package name or 'package#export'
  connection: ConnectionConfig;
  generate: GenerateConfig;
}

export interface ConnectionConfig {
  // Option 1: Connection string
  uri?: string;
  // Option 2: Individual params
  host?: string;
  port?: number;
  database?: string;
  user?: string;
  password?: string;
  // Additional driver-specific options
  [key: string]: any;
}

export interface GenerateConfig {
  schema: string[];
  outDir: string;
  pascalCaseTables?: boolean;
  camelCaseColumns?: boolean;
}

export interface ExecConfig {
  format?: 'table' | 'json' | 'csv';
  limit?: number;
  confirmMutations?: boolean;
  dryRun?: boolean;
}

export interface QueryConfig {
  queries: Record<string, QuerySettings>;
  defaults?: QueryDefaults;
}

export interface QuerySettings {
  profile?: string;
  params?: Record<string, any>;
  environments?: Record<string, Record<string, any>>;
  format?: 'table' | 'json' | 'csv';
  limit?: number;
}

export interface QueryDefaults {
  profile?: string;
  format?: 'table' | 'json' | 'csv';
  limit?: number;
}

export interface SqlParam {
  name: string;
  type: string; // 'string' | 'number' | 'boolean' | 'array' | 'object'
  required?: boolean;
  default?: any;
}
```

### Plugin Interface

```typescript
// Plugin must export default or named export
export interface ValnorPlugin {
  name: string;
  
  // Execute query (required)
  execute(query: SqlQuery, params: any, connection: ConnectionConfig): Promise<any[]>;
  
  // Generate types (optional, for codegen)
  generate?(config: GenerateConfig, connection: ConnectionConfig): Promise<void>;
}

// Plugin methods that will be spied on
type PluginExecutionMethod = 'getAll' | 'getOne' | 'execute' | 'getMany';
```

### Config Loading Strategy

```typescript
// config-loader.ts

// 1. Find root config
async function findRootConfig(cwd: string): Promise<string | null> {
  const candidates = [
    'valnor.config.ts',
    'valnor.config.mjs', 
    'valnor.config.js'
  ];
  
  for (const file of candidates) {
    const path = join(cwd, file);
    if (await exists(path)) return path;
  }
  
  return null;
}

// 2. Load config file
async function loadConfig(path: string): Promise<ValnorConfig> {
  const module = await import(path);
  return module.default || module;
}

// 3. Find file-specific config
function getQueryConfigPath(queryFilePath: string): string {
  const dir = dirname(queryFilePath);
  const name = basename(queryFilePath, extname(queryFilePath));
  return join(dir, `${name}.valnor.ts`);
}

// 4. Merge configs (priority: CLI > query > file > root)
function mergeConfigs(root, file, query, cli): ResolvedConfig {
  // Implementation
}
```

### Plugin Loading

```typescript
// plugin-spy.ts

async function loadPlugin(pluginName: string): Promise<ValNorPlugin> {
  // Handle named exports: 'valnor-postgres#PostgresPlugin'
  const [packageName, exportName] = pluginName.split('#');
  
  const module = await import(packageName);
  const plugin = exportName ? module[exportName] : module.default;
  
  if (!plugin || typeof plugin.execute !== 'function') {
    throw new Error(`Invalid plugin: ${pluginName}`);
  }
  
  return plugin;
}

function createPluginSpy(plugin: ValnorPlugin, onCapture: CaptureCallback): ValnorPlugin {
  return new Proxy(plugin, {
    get(target, prop) {
      const methods = ['getAll', 'getOne', 'execute', 'getMany'];
      
      if (methods.includes(prop as string)) {
        return function(query: SqlQuery, params: any) {
          // Capture query details
          onCapture({
            query,
            method: prop as string,
            sql: query.getSql(params),
            values: query.getValues(params),
            params: query.params,
          });
          
          // Return promise that will be resolved by exec command
          return new Promise((resolve) => {
            // Store resolve for later
          });
        };
      }
      
      return target[prop];
    }
  });
}
```

### Error Messages

```typescript
// Common error scenarios

const ERRORS = {
  NO_CONFIG: 'No valnor.config.ts found. Run `valnor exec init` to create one.',
  NO_PROFILE: (name: string) => `Profile '${name}' not found in config. Available: ${availableProfiles.join(', ')}`,
  NO_QUERY: (name: string, file: string) => `Query '${name}' not found in ${file}`,
  INVALID_QUERY: (name: string) => `'${name}' is not a valid SqlQuery object`,
  MISSING_PARAMS: (params: string[]) => `Missing required parameters: ${params.join(', ')}`,
  CONNECTION_ERROR: (error: Error) => `Database connection failed: ${error.message}`,
  QUERY_ERROR: (sql: string, error: Error) => `Query failed:\n${sql}\n\nError: ${error.message}`,
  PLUGIN_LOAD_ERROR: (name: string) => `Failed to load plugin '${name}'. Make sure it's installed.`,
};
```

### Execution Flow (Detailed)

```typescript
// exec/index.ts - Main flow

async function execCommand(options: ExecOptions) {
  // 1. Load root config
  const rootConfig = await loadRootConfig(process.cwd());
  
  // 2. Load file-specific config (if exists)
  const fileConfig = await loadFileConfig(options.file);
  
  // 3. Resolve profile
  const profile = resolveProfile(options, fileConfig, rootConfig);
  
  // 4. Load plugin
  const plugin = await loadPlugin(profile.plugin);
  
  // 5. Create spy
  let captured: CapturedQuery;
  const spy = createPluginSpy(plugin, (data) => { captured = data; });
  
  // 6. Inject spy globally
  global.__valnor_plugin__ = spy;
  
  // 7. Dynamic import query file
  const module = await import(options.file);
  
  // 8. Get query by name
  const query = module[options.query];
  if (!query) throw new Error(ERRORS.NO_QUERY(options.query, options.file));
  
  // 9. Collect params
  const params = await collectParams(query.params, options, fileConfig, rootConfig);
  
  // 10. Display SQL
  displaySQL(captured.sql, captured.values);
  
  // 11. Execute if not dry-run
  if (!options.dryRun && !options.sqlOnly) {
    const results = await plugin.execute(query, params, profile.connection);
    
    // 12. Format and display
    const formatter = getFormatter(options.format);
    formatter.display(results);
  }
}
```

### Config Validation

```typescript
// config/define-config.ts

export function defineConfig(config: ValNorConfig): ValNorConfig {
  // Validate structure
  if (!config.profiles || Object.keys(config.profiles).length === 0) {
    throw new Error('Config must have at least one profile');
  }
  
  // Validate each profile
  for (const [name, profile] of Object.entries(config.profiles)) {
    if (!profile.plugin) {
      throw new Error(`Profile '${name}' missing plugin`);
    }
    if (!profile.connection) {
      throw new Error(`Profile '${name}' missing connection`);
    }
    if (!profile.generate) {
      throw new Error(`Profile '${name}' missing generate config`);
    }
  }
  
  return config;
}

export function defineQueryConfig(config: QueryConfig): QueryConfig {
  // Validate query config
  if (!config.queries || Object.keys(config.queries).length === 0) {
    throw new Error('Query config must have at least one query');
  }
  
  return config;
}
```

### Default Param Values by Type

```typescript
// exec/init.ts - For config generation

function getDefaultValue(type: string): any {
  switch (type) {
    case 'string': return '';
    case 'number': return 0;
    case 'boolean': return false;
    case 'array': return [];
    case 'object': return {};
    default: return null;
  }
}
```

### Module Loading (ESM/CJS)

```typescript
// Use dynamic import for both ESM and CJS
// Node.js handles this automatically

async function loadModule(path: string) {
  try {
    const module = await import(path);
    return module.default || module;
  } catch (error) {
    throw new Error(`Failed to load ${path}: ${error.message}`);
  }
}
```

## Notes

- `defineConfig()` and `defineQueryConfig()` must be implemented in valnor package with validation
- `SqlQuery.params` property must be added as `Record<string, SqlParam>` for runtime param introspection
- Plugin spy/proxy pattern allows natural code execution while intercepting DB calls
- `valnor exec init` uses dynamic import + `SqlQuery.params` to scaffold config files
- Plugins are loaded by package name (e.g., `'valnor-postgres'`)
- Named exports supported via `#` syntax: `'valnor-postgres#PostgresPlugin'`
- ASCII table rendering uses `cli-table3` library
- Each profile is self-contained with plugin, connection, and generate options
- Same profile used for both `valnor generate` and `valnor exec` commands
- No TypeScript parsing needed - dynamic import with spy handles everything
