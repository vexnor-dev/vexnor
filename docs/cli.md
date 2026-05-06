# CLI Reference

## Generate

```bash
npx vexnor codegen [options]
```

Options:

- `--plugin <name>` plugin package name (required)
- `--schema <name>` database schema (repeatable)
- `--uri <connection>` connection URI
- `--host <host>`
- `--port <port>`
- `--database <name>`
- `--user <username>`
- `--password <password>`
- `--outDir <path>` output directory for generated files
- `--pascalCaseTables`
- `--camelCaseColumns`
- `--omit <tables...>` tables/views to exclude

## Exec

Initialize:

```bash
npx vexnor exec init
```

Run:

```bash
npx vexnor exec run <query> [options]
```

Common options:

- `-c, --config <path>` config path (default: `vexnor.config.ts`)
- `-q, --query-config <path>` query config path (required)
- `-e, --env <name>` parameter environment
- `-f, --format <format>` `table | json | csv`
- `-l, --limit <number>` row limit
- `--dry-run` print SQL only
- `--no-confirm` skip mutation confirmation
