# Params

## Two Ways to Pass Values

Both styles bind values as SQL parameters at execution time — neither inlines raw values into the SQL string.

### Inline Value Injection

Embed a value directly in the template literal. Best for local query composition where the value is known at query-build time.

```typescript
const status = 'ACTIVE';

const query = sql`
  SELECT ${row(Account.$$)}
  FROM ${Account}
  WHERE ${Account.$status} = ${status}
`;

await query.postgres.all({ db: pool });
```

### Named Params with `param()`

Declare a typed, named parameter. Best for reusable queries where the value is supplied at execution time.

```typescript
const findByStatus = sql`
  SELECT ${row(Account.$$)}
  FROM ${Account}
  WHERE ${Account.$status} = ${param<{ status: string }>('status')}
`;

await findByStatus.postgres.all({
  db: pool,
  params: { status: 'ACTIVE' },
});
```

The type argument to `param<T>` is the full params record for the query. The key picks one property from it. TypeScript enforces the correct `params` object at execution time.

### Multiple Params

Share the same type argument across all `param()` calls in a query:

```typescript
type Params = { firstName: string; email: string };

const query = sql`
  SELECT ${row(Account.$$)}
  FROM ${Account}
  WHERE ${Account.$firstName} = ${param<Params>('firstName')}
    AND ${Account.$email} = ${param<Params>('email')}
`;

await query.postgres.one({
  db: pool,
  params: { firstName: 'Jane', email: 'jane@example.com' },
});
```

### Mixing Both Styles

```typescript
const activeStatus = 'ACTIVE';

const query = sql`
  SELECT ${row(Account.$$)}
  FROM ${Account}
  WHERE ${Account.$status} = ${activeStatus}
    AND ${Account.$email} = ${param<{ email: string }>('email')}
`;

await query.postgres.one({
  db: pool,
  params: { email: 'jane@example.com' },
});
```

## Runtime Validation

Attach validation rules to `param()` as a second argument. Rules are type-aware — TypeScript will only allow rules that apply to the param's type.

```typescript
const findByEmail = sql`
  SELECT ${row(Account.$$)}
  FROM ${Account}
  WHERE ${Account.$email} = ${param<{ email: string }>('email', {
    minLength: 5,
    pattern: /@/,
  })}
`;
```

### Validation Rules

**`string`**
- `minLength: number` — minimum string or array length
- `maxLength: number` — maximum string or array length
- `pattern: RegExp` — must match the pattern

**`number` / `Date`**
- `min: number | Date` — minimum value
- `max: number | Date` — maximum value

**`array`**
- `minLength: number` — minimum array length
- `maxLength: number` — maximum array length

**Any type**
- `enum: readonly T[]` — value must be one of the listed values
- `validate: (value: T) => boolean | string` — custom validation function; return `false` or an error string to fail

```typescript
param<{ status: string }>('status', {
  enum: ['ACTIVE', 'INACTIVE', 'PENDING'] as const,
})

param<{ age: number }>('age', {
  min: 0,
  max: 120,
})

param<{ email: string }>('email', {
  validate: (v) => v.includes('@') || 'must be a valid email',
})
```

## Null Normalization

At runtime, missing or `undefined` param values are normalized to `null` before SQL binding. This means omitting an optional param is safe — it will bind as `NULL` rather than throwing.
