# Installation

You can either install the package locally as dev dependency:

```bash
npm install valnor
```

Or use it directly with npx/pnpx without installation:
```bash
# Using npx (npm)
npx valnor generate --driver postgres --cli one_sql --uri $POSTGRES_URI --outDir 'src/models'

# Using pnpm
pnpm dlx valnor generate --driver postgres --cli one_sql --uri $POSTGRES_URI --outDir 'src/models'
```

Loading environment variables from local .env file:
```bash
env-cmd -x -f .env valnor generate --cli one_sql --pascalCaseTables --camelCaseColumns --uri $POSTGRES_URI --outDir 'src/models'
```