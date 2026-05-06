# CRUD Query Factories

Generated tables expose typed query factories on the plugin property (`.postgres`, `.mssql`, `.sqlite`).

## Methods

- `findById()`
- `findBy()`
- `select(...)`
- `insertRows()`
- `update(...)`
- `delete(...)`
- `upsert(...)` (PostgreSQL/MSSQL)

## Execution

All factories share execution methods:

- `.one({ db, params? })` returns `T`, throws if empty
- `.any({ db, params? })` returns `T | null`
- `.all({ db, params? })` returns `T[]`
- `.run({ db, params? })` returns execution metadata/void

## Minimal Example

```typescript
const row = await Account.postgres.findById().any({
  db: pool,
  params: { accountId: '123' },
});
```

## Param Validation

You can define runtime validation at `param(...)` call sites used by CRUD/custom queries:

```typescript
const byEmail = sql`
  SELECT ${row(Account.$$)}
  FROM ${Account}
  WHERE ${Account.$email} = ${param<{ email: string }>("email", {
    minLength: 5,
    pattern: /@/,
  })}
`;
```

Notes:

- Rule typing is constrained by param type (`pattern` is string-only, `min/max` are number/date-only).
- Missing/`undefined` params are normalized to `null` before SQL binding.
