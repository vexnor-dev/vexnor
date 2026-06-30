# @vexnor/example-react-next-app

A Next.js App Router example demonstrating isomorphic SQL execution with Vexnor across PostgreSQL, MS SQL Server, and SQLite3.

## What this shows

- **React Server Components** fetching data directly from the database — no API layer, no `useEffect`, no loading state
- **Server Actions** for create/delete mutations — same query objects used on the server, no separate endpoint needed
- **`/api/db` route** — a `QueryRegistry` endpoint that allows the same queries to be executed remotely from the client when needed
- **Shared queries** — one query definition works across RSC, Server Actions, and remote execution
- **Three databases** — PostgreSQL, MS SQL Server, SQLite3, each with identical query patterns

## Structure

```
app/
  postgres/accounts/   # PostgreSQL accounts page
  mssql/accounts/      # MS SQL Server accounts page
  sqlite3/accounts/    # SQLite3 accounts page
  api/db/              # QueryRegistry HTTP endpoint
  components/          # Shared UI components

shared/
  queries/             # Query definitions (postgres.ts, mssql.ts, sqlite3.ts)
  db/                  # DB connection singletons
  codegen/             # Generated types (postgres/, mssql/, sqlite3/)
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

This runs codegen for all three databases in parallel. Requires the databases to be running and `env-dev.json` configured at the repo root.

### 3. Run the dev server

```bash
pnpm dev
```

This builds all referenced workspace packages (`vexnor`, `@vexnor/postgres`, `@vexnor/mssql`, `@vexnor/sqlite3`) via `tsc -b` before starting Next.js.

Open [http://localhost:3000](http://localhost:3000).

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
