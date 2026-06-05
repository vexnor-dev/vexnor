# @vexnor/example-react-vite-api

A React + Vite + Hono example demonstrating isomorphic SQL execution with Vexnor across PostgreSQL, MS SQL Server, and SQLite3.

## What this shows

- **Isomorphic queries** — the same query object defined once in `shared/queries/` runs both on the server (Hono) and from the browser (via `remoteClient` → `/api/db`)
- **`runtime()` / `runtimeValue`** — `selectMyOrders` uses `runtime("userId")` so the user ID is injected server-side from the registry context; the client passes `runtimeValue` which is stripped before the HTTP request is sent
- **`QueryRegistry`** — the server registers all queries at startup; the client dispatches by hash, never sending raw SQL over the wire
- **Per-DB auth sessions** — each database (postgres, mssql, sqlite3) has its own independent login session; `useAuth(db)` and `useRemoteClient(db)` are scoped per database
- **Login picker** — a demo login screen for each database lets you sign in as any account; the selected `account_id` becomes the runtime `userId` injected into `selectMyOrders`
- **`use(Promise)` + `Suspense`** — data fetching with React's built-in streaming primitives, no extra library
- **URL search params for filtering** — `?filter=john` drives server-side SQL filtering, shareable and bookmarkable
- **Three databases** — PostgreSQL, MS SQL Server, SQLite3, each with identical query patterns
- **`vexnor.config.ts`** — full CLI exec config; run any query directly against the example DBs with `vexnor exec run`

## Architecture

```
client/                          server/
  pages/                           src/
    postgres-accounts.tsx  ──►       server.ts  (Hono + QueryRegistry)
    postgres-login.tsx               │
    mssql-accounts.tsx               ▼
    mssql-login.tsx                /api/db  (POST)
    sqlite3-accounts.tsx             │
    sqlite3-login.tsx                ▼
  components/                      shared/queries/
    account-grid.tsx                 postgres.ts  ◄── same file used by both
    my-orders.tsx                    mssql.ts
    create-account-form.tsx          sqlite3.ts
    search-input.tsx
```

## Structure

```
client/src/
  pages/           Per-database account pages + login pages (postgres, mssql, sqlite3)
  components/      AccountGrid, MyOrders, CreateAccountForm, SearchInput
  routes/          TanStack Router setup with search param validation
  auth-context.tsx Per-DB session state; useAuth(db), useAuthSessions()
  use-remote-client.ts  Auth-aware remoteClient hook; useRemoteClient(db)

server/src/
  server.ts        Hono server — QueryRegistry, DB connections, /api/db

shared/
  queries/         Query definitions (postgres.ts, mssql.ts, sqlite3.ts)
                   Query exec configs (postgres.vexnor.ts, mssql.vexnor.ts, sqlite3.vexnor.ts)
  codegen/         Generated types (postgres/, mssql/, sqlite3/)

vexnor.config.ts   CLI exec config — profiles for all three databases
```

## Getting started

### 1. Install dependencies

```bash
pnpm install
```

### 2. Generate types from your database schema

```bash
pnpm codegen
```

Runs codegen for all three databases in parallel. Requires the databases to be running and `env-dev.json` configured at the repo root.

### 3. Run dev server + client

```bash
pnpm dev
```

Starts the Hono API server on port `3001` and the Vite dev server on port `5173`.

Open [http://localhost:5173](http://localhost:5173).

### 4. Run queries via CLI (optional)

```bash
# Dry-run selectMyOrders with a runtime userId override
npx vexnor exec run selectMyOrders -q shared/queries/postgres.vexnor.ts --runtime userId=<account-id> --dry-run

# Run selectAccounts against SQLite3
npx vexnor exec run selectAccounts -q shared/queries/sqlite3.vexnor.ts
```

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `POSTGRES_HOST` | `localhost` | PostgreSQL host |
| `POSTGRES_PORT` | `5432` | PostgreSQL port |
| `POSTGRES_DATABASE` | `postgres` | PostgreSQL database |
| `POSTGRES_USER` | `postgres` | PostgreSQL user |
| `POSTGRES_PASSWORD` | `postgres` | PostgreSQL password |
| `MSSQL_HOST` | `localhost` | MS SQL Server host |
| `MSSQL_PORT` | `1433` | MS SQL Server port |
| `MSSQL_DATABASE` | `vexnor` | MS SQL Server database |
| `MSSQL_USER` | `vexnor_dev` | MS SQL Server user |
| `MSSQL_PASSWORD` | `P@ssw0rd!` | MS SQL Server password |
| `SQLITE_PATH` | `../../@db-sqlite3/vexnor-dev.sqlite` | Path to SQLite database file |

## Key files

| File | Description |
|---|---|
| `shared/queries/postgres.ts` | Query definitions — shared between client and server |
| `shared/queries/postgres.vexnor.ts` | CLI exec config for postgres queries (includes `runtimeValue` for `selectMyOrders`) |
| `server/src/server.ts` | QueryRegistry registration + `/api/db` endpoint |
| `client/src/auth-context.tsx` | Per-DB auth sessions — `useAuth(db)`, `useAuthSessions()` |
| `client/src/use-remote-client.ts` | Auth-aware `remoteClient` hook — `useRemoteClient(db)` |
| `client/src/remote-client.ts` | Static `remoteClient` (no auth) |
| `client/src/pages/postgres-accounts.tsx` | Tabs: My Orders (runtime userId) + Accounts CRUD |
| `client/src/pages/postgres-login.tsx` | Login picker — sign in as any account |
| `client/src/components/my-orders.tsx` | Orders table driven by `runtime("userId")` |
| `vexnor.config.ts` | CLI exec profiles for all three databases |
