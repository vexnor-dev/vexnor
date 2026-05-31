# @vexnor/example-react-vite-api

A React + Vite + Hono example demonstrating isomorphic SQL execution with Vexnor across PostgreSQL, MS SQL Server, and SQLite3.

## What this shows

- **Isomorphic queries** — the same query object defined once in `shared/queries/` runs both on the server (Hono) and from the browser (via `remoteClient` → `/api/db`)
- **`QueryRegistry`** — the server registers all queries at startup; the client dispatches by hash, never sending raw SQL over the wire
- **`remoteClient`** — a typed `RemoteClient` that makes `.postgres.all({ db: remoteClient })` work from the browser exactly like it does on the server
- **Auth-aware remote client** — `useRemoteClient()` attaches a JWT `Authorization` header when the user is signed in
- **`use(Promise)` + `Suspense`** — data fetching with React's built-in streaming primitives, no extra library
- **URL search params for filtering** — `?filter=john` drives server-side SQL filtering, shareable and bookmarkable
- **Three databases** — PostgreSQL, MS SQL Server, SQLite3, each with identical query patterns

## Architecture

```
client/                          server/
  pages/                           src/
    postgres-accounts.tsx  ──►       server.ts  (Hono + QueryRegistry)
    mssql-accounts.tsx               │
    sqlite3-accounts.tsx             ▼
  components/                      /api/db  (POST)
    account-grid.tsx                 │
    create-account-form.tsx          ▼
    search-input.tsx            shared/queries/
                                  postgres.ts  ◄── same file used by both
                                  mssql.ts
                                  sqlite3.ts
```

## Structure

```
client/src/
  pages/           Per-database account pages
  components/      AccountGrid, CreateAccountForm, SearchInput
  routes/          TanStack Router setup with search param validation

server/src/
  server.ts        Hono server — QueryRegistry, DB connections, /api/db

shared/
  queries/         Query definitions (postgres.ts, mssql.ts, sqlite3.ts)
  codegen/         Generated types (postgres/, mssql/, sqlite3/)
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
| `server/src/server.ts` | QueryRegistry registration + `/api/db` endpoint |
| `client/src/remote-client.ts` | Static `remoteClient` (no auth) |
| `client/src/use-remote-client.ts` | Auth-aware `remoteClient` hook |
| `client/src/pages/postgres-accounts.tsx` | `use(Promise)` + Suspense data fetching pattern |
