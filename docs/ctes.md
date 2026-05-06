# CTE Patterns

Vexnor supports typed CTEs and recursive CTEs with inferred output columns.

## Basic CTE

```typescript
const ActiveAccounts = sql`
  SELECT ${row(Account.$$)}
  FROM ${Account}
  WHERE ${Account.$status} = 'active'
`;

const result = await sql`
  WITH ${ActiveAccounts}
  SELECT ${row(ActiveAccounts.$$)}
  FROM ${ActiveAccounts}
`.postgres.all({ db: pool });
```

## Recursive CTE

Use `query.out` inside recursive branches so the reference renders as the CTE name.

```typescript
const anchor = sql`
  SELECT ${row(Account.$$)}, ${val`0`.as<{ depth: number }>('depth')}
  FROM ${Account}
  WHERE ${Account.$parentId} IS NULL
`;

const hierarchy = sql`
  ${anchor} UNION ALL
  SELECT ${row(Account.as('b').$$)},
         ${anchor.out.$depth} + 1 as ${col<{ depth: number }>('depth')}
  FROM ${Account.as('b')}
  JOIN ${anchor.out} ON ${anchor.out.$accountId} = ${Account.as('b').$parentId}
`;
```
