# Vexnor Go Example API

Minimal HTTP API demonstrating the Vexnor Go SDK — loads query manifests, connects to PostgreSQL/MSSQL/SQLite, and executes queries by hash.

## Run

```bash
cd stacks/golang/example && go run .
```

The server starts on port 5001 by default.

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `GO_EXAMPLE_PORT` | `5001` | HTTP listen port |
| `VEXNOR_MANIFEST_DIR` | `../../fixtures/manifests` | Base directory for manifest files |
| `POSTGRES_HOST` | `localhost` | PostgreSQL host |
| `POSTGRES_PORT` | `5432` | PostgreSQL port |
| `POSTGRES_USER` | `postgres` | PostgreSQL user |
| `POSTGRES_PASSWORD` | `postgres` | PostgreSQL password |
| `POSTGRES_DATABASE` | `postgres` | PostgreSQL database |
| `MSSQL_HOST` | `localhost` | MSSQL host |
| `MSSQL_PORT` | `1433` | MSSQL port |
| `MSSQL_USER` | `vexnor_dev` | MSSQL user |
| `MSSQL_PASSWORD` | `P@ssw0rd!` | MSSQL password |
| `MSSQL_DATABASE` | `vexnor` | MSSQL database |
| `SQLITE_PATH` | `../../fixtures/vexnor.db` | SQLite database file path |

## Endpoints

### GET /api/health

Returns server status and loaded query counts per dialect.

```bash
curl http://localhost:5001/api/health
```

```json
{"status": "ok", "queries": {"postgres": 5, "mssql": 5, "sqlite3": 5}}
```

### POST /api/db

Execute a registered query by hash.

```bash
curl -X POST http://localhost:5001/api/db \
  -H "Content-Type: application/json" \
  -d '{"hash": "abc123", "params": {}, "context": {}, "backend": "postgres"}'
```

Request body:

| Field | Type | Required | Description |
|---|---|---|---|
| `hash` | string | yes | Query hash from the manifest |
| `params` | object | no | Query parameters |
| `context` | object | no | Context values (e.g. authenticated userId) |
| `backend` | string | no | `"postgres"`, `"mssql"`, or `"sqlite3"` (default: `"postgres"`) |

Response codes:

| Status | Condition |
|---|---|
| 200 | Success — `{"rows": [...]}` |
| 400 | Invalid JSON, unknown backend, or missing executor |
| 403 | Missing required context value or authorization denied |
| 404 | Unknown query hash |
| 500 | Database or execution error |

## Manifest Directory Structure

```
manifests/
├── postgres/   ← *.json manifest files for PostgreSQL dialect
├── mssql/      ← *.json manifest files for MSSQL dialect
└── sqlite3/    ← *.json manifest files for SQLite dialect
```

Generate manifests with:

```bash
npx vexnor serialize --outDir stacks/fixtures/manifests
```
