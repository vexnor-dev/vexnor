# Installation

You can either install the package locally as dev dependency:

```bash
npm install sql-typecraft
```

Or use it directly with npx/pnpx without installation:
```bash
# Using npx (npm)
npx sql-typecraft generate --driver pg --schema one_sql --uri $POSTGRES_URI --outDir 'src/codegen'

# Using pnpm
pnpm dlx sql-typecraft generate --driver pg --schema one_sql --uri $POSTGRES_URI --outDir 'src/codegen'
```

Loading environment variables from local .env file:
```bash
env-cmd -x -f .env sql-typecraft generate --schema one_sql --pascalCaseTables --camelCaseColumns --uri $POSTGRES_URI --outDir 'src/codegen'
```