# Usage

## Command Line Interface

The basic command structure:

```bash
valnor generate [options]
```

## Options

**Common options:**
- `--schema` - db schema name (default: "public"). Possible to include multiple schemas: `--schema schema1 --schema schema2 ...`
- `--driver` - db driver: `pg`, `postgres.js`
- `--pascalCaseTables` - Convert table names to PascalCase
- `--camelCaseColumns` - Convert column names to camelCase
- `--uri` - PostgreSQL connection URI
- `--outDir` - Output directory for generated files
- `--help` - Show help information

## Generating database mapping code with Valnor CLI

```bash
valnor generate --cli one_sql --pascalCaseTables --camelCaseColumns --uri $POSTGRES_URI --outDir 'src/models'
```

Including multiple schemas:
```bash
valnor generate --cli one_sql --cli two_sql --uri $POSTGRES_URI --outDir 'src/models'
```