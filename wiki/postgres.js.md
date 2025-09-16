# postgres.js

Example using `postgres.js` instead of `pg`:
> notice cli option `--driver postgres.js` flag

```bash
npx valnor generate --driver postgres.js --cli one_sql --uri $POSTGRES_URI --outDir 'src/codegen'
```

> You can find the complete guide for postgres.js: https://www.npmjs.com/package/postgres 

```typescript
const sql = postgres({
    host: "localhost",
    user: "postgres",
    database: "postgres",
    transform: {
        ...postgres.camel, /* include for transforming snake_case columns into camelCase fields */
        undefined: null,
    }
});
```