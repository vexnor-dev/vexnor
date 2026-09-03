# AI Integration

Vexnor is built to let AI agents talk to your database safely. An agent can discover your schema, resolve foreign-key join paths, compose typed queries, and read data — all through a bounded, read-only surface where **SQL injection is structurally impossible**. The agent never writes SQL; it invokes tools and registered queries.

This page is the hub for Vexnor's AI-native capabilities. Each section links to the detailed reference.

## Why Vexnor for AI

- **The schema graph is the API.** Agents discover tables, columns, and relationships from a machine-readable schema — no predefined endpoints to author or maintain.
- **The agent never emits SQL.** It calls tools and invokes pre-registered queries by hash, or builds runtime CRUD that is validated against the schema before any SQL is generated.
- **Every value is parameterized.** Interpolated values become driver placeholders (`$1`, `?`), never string-concatenated. There is no API that accepts a raw SQL string from an agent.
- **Bounded by construction.** The MCP server exposes only explicitly named tools, over a selected subset of the schema, with row/timeout/concurrency budgets.

## MCP Server

`vexnor schema mcp` starts a local stdio Model Context Protocol server for a persisted datasource selection. It does not listen on a network port, and it exposes no tool unless the tool is named explicitly in `--tools`.

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

Three read-only tools:

| Tool | Purpose |
|------|---------|
| `getSchema` | Exposes only the selected schema metadata — tables, columns, relationships, and per-object capabilities/limitations. |
| `join` | Registers a structured read-only query composed through known selected relationships. |
| `fetchData` | Executes only an opaque query hash already registered by the session. It never accepts SQL. |

Startup fails closed if the profile has no persisted selection, or if the selection no longer reconciles safely with the live catalog. Use a read-only database account for the profile and keep credentials in the profile's environment-backed connection config — never in MCP arguments or prompts.

→ See [CLI — `vexnor schema mcp`](cli.md#vexnor-schema-mcp) for all options and a Codex one-shot launch example.

## Schema Discovery

`SchemaGraph` gives an agent everything it needs to reason about your data model: FK-based introspection and automatic BFS shortest-path join resolution between any two tables.

```ts
import { SchemaGraph } from "@vexnor/core/execution";
import * as schema from "./models";

const graph = new SchemaGraph(schema);

// Compact text tailored for an LLM system prompt
graph.formatOverview();       // one line per table
graph.formatTable("public.payment");   // single-table detail
graph.formatRelationships();  // FK relationship graph

// Resolve a join path the agent didn't have to know in advance
graph.joinPath("public.payment", "public.city");
```

The `formatOverview` / `formatTable` / `formatRelationships` methods produce compact descriptions designed to drop directly into an LLM prompt. `join` / `joinBy` return a composed `SqlQuery` ready to register, plus the exact `joinBy` params to pass to `fetchData`.

→ See [Schema Graph](schema-graph.md) for the full API and `JoinResult` shape.

## Runtime CRUD for Agents

An agent (or any dynamic caller) can construct queries from column metadata alone — no predefined query per filter combination. Every `select()` query automatically accepts `filterBy`, `orderBy`, `limit`, and `offset` params at runtime.

```typescript
// An AI agent fetches: active accounts created this year,
// excluding spam, sorted by email, page 1
const accounts = await Account.postgres.select({}).all({
  db: pool,
  params: {
    filterBy: [
      { status: ["in", "active", "confirmed"] },
      { createdAt: [">=", "2024-01-01"] },
      { email: ["notLike", "%@spam.%"] },
      { or: [{ email: ["like", "%@vip.com"] }, { parentId: ["isNotNull"] }] },
    ],
    orderBy: { email: "ASC" },
    limit: 25,
    offset: 0,
  },
});
```

All operators are validated against the table schema before any SQL is built:

- **Unknown columns** throw at build time: `Column not found: badColumn`
- **Invalid operators** throw at build time: `Invalid filter operator: badOp`
- **Non-primitive bare values** throw: `Filter value is not a primitive`
- All values are always parameterized — SQL injection is structurally impossible

Use `filterBy(Table, { omit: [...] })` inside a `sql` tag to keep sensitive columns off the runtime-filterable surface.

→ See [CRUD — Runtime Filter](crud.md#runtime-filter-paramsfilterby) for operators, `orderBy`, and column restriction.

## Runtime Projections and Windows

Agents can shape results at call time without a new query definition:

- **`viewBy`** — the projection field on `ExecuteQueryArgs`; the registry applies `.toView()` before execution to restrict columns and inject window expressions. The `fetchData` tool extracts `viewBy` from params automatically.
- **`windowBy`** — pass window functions in `params` at runtime; columns are available on the result, built dynamically from the schema graph.

→ See [Projections — AI Runtime (viewBy)](projections.md#ai-runtime-viewby) and [Window Functions — Dynamic Usage (AI Agents)](window-functions.md#dynamic-usage-ai-agents).

## Machine-Readable Schema (No Live DB)

`serializeSchema()` exports table metadata — columns, primary keys, foreign keys, types — as a standalone JSON manifest, independent of any live database connection.

```typescript
import { serializeSchema } from '@vexnor/core';
import * as schema from './models/public.schema.js';

const manifest = serializeSchema(schema, 'postgresql');
// Feed the JSON to an LLM so it can discover tables, columns,
// and relationships at runtime — no database connection required.
```

The same manifest powers the cross-runtime `SchemaGraph` in the .NET and Go SDKs.

→ See [Serialize — Schema Manifest](serialize.md#schema-manifest).

## Security Model

The properties that make agent access safe are structural, not conventions:

1. **No raw-SQL entry point.** `fetchData` runs only a query hash already registered by the session. `join` composes through known relationships. Neither accepts a SQL string.
2. **Parameterization is enforced by the tagged-template architecture.** Values can only reach the driver as bound parameters.
3. **Explicit tool scoping.** Only tools named in `--tools` exist. Omit `fetchData` and the agent can inspect and compose but never read rows.
4. **Selected schema only.** `getSchema` exposes just the persisted selection; the server fails closed if the selection drifts from the live catalog.
5. **Budgets.** `--max-rows`, `--timeout-ms`, and `--max-concurrency` cap what a single fetch and the session as a whole can consume.

## See Also

- [CLI](cli.md) — `vexnor schema select`, `vexnor schema mcp`, tool scoping
- [Schema Graph](schema-graph.md) — introspection, BFS join resolution, prompt formatting
- [CRUD](crud.md) — runtime `filterBy` / `orderBy` and column restriction
- [Projections](projections.md) — `viewBy` runtime projection
- [Window Functions](window-functions.md) — runtime `windowBy`
- [Serialize](serialize.md) — machine-readable schema and query manifests
- [Isomorphic SQL](isomorphic-sql.md) — hash-only client dispatch and the security model it shares with the agent surface
