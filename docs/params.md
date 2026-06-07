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

The type argument `T` is the full params record for the query — the key picks one property from it. TypeScript enforces the correct `params` object at execution time.

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
- `minLength: number` — minimum string length
- `maxLength: number` — maximum string length
- `pattern: RegExp` — must match the pattern

**`number` / `Date`**
- `min: number | Date` — minimum value
- `max: number | Date` — maximum value

**`array`**
- `minLength: number` — minimum array length
- `maxLength: number` — maximum array length

**Any type**
- `enum: readonly T[]` — value must be one of the listed values (strict equality)
- `values: readonly T[]` — alias for `enum`; prefer this for string whitelists for readability
- `validate: (value: T) => boolean | string` — custom validation function; return `false` or an error string to fail

```typescript
param<{ status: string }>('status', {
  values: ['ACTIVE', 'INACTIVE', 'PENDING'] as const,
})

param<{ age: number }>('age', {
  min: 0,
  max: 120,
})

param<{ email: string }>('email', {
  validate: (v) => v.includes('@') || 'must be a valid email',
})
```

### Default Values

Add a `default` to any validation rule. When the param is `undefined`, the default is used. When the param is present but invalid and a default is declared, it silently falls back to the default instead of throwing.

```typescript
// undefined → 'created_at'; invalid value → 'created_at'
const orderBy = param<{ orderBy?: string }>('orderBy', {
  values: ['email', 'created_at', 'first_name'],
  default: 'created_at',
});

// undefined → 'DESC'; invalid value → 'DESC'
const orderDir = param<{ orderDir?: string }>('orderDir', {
  values: ['ASC', 'DESC'],
  default: 'DESC',
});
```

Without a `default`, an invalid value throws `SqlBuildError` with code `PARAM_VALIDATION_FAILED`.

## Context Params with `ctx()`

`ctx()` declares a named parameter whose value is **server-injected** rather than caller-supplied. It is identical to `param()` at the SQL level — it emits a placeholder at build time — but the `QueryRegistry` fills it automatically from the trusted context object passed to `registry.execute()` instead of accepting it from the caller's `params`.

This is the correct mechanism for row-level access control: bake the restriction into the query itself so it cannot be bypassed, rather than relying on the authorization callback to check it after the fact.

```typescript
import { ctx } from 'vexnor';

// Only returns orders belonging to the currently authenticated user
const myOrders = sql`
  SELECT ${row(Order.$$)}
  FROM ${Order}
  WHERE ${Order.$userId} = ${ctx<{ userId: string }>('userId')}
  ORDER BY ${Order.$createdAt} DESC
`;
```

When this query runs through the registry, `userId` is pulled from the server-side context — the caller never provides it and cannot override it.

### Registry setup

Type the `QueryRegistry` with the shape of your context. Every field available in the context is a candidate for `ctx()` params:

```typescript
type AppRuntime = { userId: string; tenantId: string };

const registry = new QueryRegistry<AppRuntime>();
await registry.register(vexnorPostgres, { myOrders });
```

In the HTTP handler, populate the context from the verified session:

```typescript
app.post('/api/db', async (c) => {
  const args = await c.req.json();
  const session = await verifyToken(c.req.header('Authorization'));

  const result = await registry.execute(
    args,
    async () => pool,
    { userId: session.userId, tenantId: session.tenantId }, // ← trusted runtime context
  );
  return c.json(result);
});
```

The registry merges `userId` from the context into the query params automatically — the HTTP client never sends it.

### Direct execution

Outside the registry (scripts, tests, server actions), context params are passed like regular params:

```typescript
await myOrders.postgres.all({
  db: pool,
  params: { userId: 'u-123' },
});
```

### Isomorphic execution — `runtimeValue`

When calling a query with `ctx()` params from the browser via `remoteClient`, the client doesn't know the user's server-side identity. Use the `runtimeValue` sentinel to satisfy the TypeScript type requirement without sending an actual value:

```typescript
import { runtimeValue } from 'vexnor';

await myOrders.postgres.all({
  db: remoteClient,
  params: { userId: runtimeValue }, // ← stripped before sending; server injects from context
});
```

`runtimeValue` is a branded sentinel — it is assignable to any param type but is stripped by the remote client before the HTTP request is sent. The real value is injected server-side from the registry context. Passing `runtimeValue` on a direct server execution (without the registry) produces `null`.

### Validation

`ctx()` accepts the same validation rules as `param()`. Use validation to catch misconfiguration early — if the context object is missing a required value or provides an invalid one, the query throws before executing rather than silently passing `null` to the database:

```typescript
ctx<{ userId: string }>('userId', { minLength: 1 })
```

### Default values

`ctx()` supports `default` for legitimate fallback scenarios, such as admin impersonation:

```typescript
// When context.impersonatedUserId is set, use it; otherwise fall back to context.userId
const viewAs = ctx<{ impersonatedUserId?: string }>('impersonatedUserId', {
  default: undefined, // registry will use undefined → falls through to your query logic
});
```

A more common pattern is two separate context params:

```typescript
const effectiveUserId = ctx<{ effectiveUserId: string }>('effectiveUserId');
// In the registry context: { effectiveUserId: impersonating ? targetId : session.userId }
```

### `ctx()` vs `param()`

| | `param()` | `ctx()` |
|---|---|---|
| Value source | Caller-supplied `params` | Registry context (server-injected) |
| Direct execution | Pass in `params` | Pass in `params` |
| Isomorphic (remote) execution | Caller sends in request | Use `contextValue` sentinel; stripped before sending |
| Registry execution | Caller sends in request | Injected from server context |
| Contributes to `query.hash` | Yes (as param) | Yes (as context, separately keyed) |
| Validation | Yes | Yes |
| Default values | Yes | Yes |

## `expand()` — Dynamic SQL Expansion

`expand` lazily builds a list of SQL nodes at query execution time. Use it when the shape or number of SQL fragments depends on runtime values — `IN (...)` lists, dynamic `ORDER BY`, conditional `SET` clauses, etc.

```typescript
import { expand } from 'vexnor';

const findByIds = sql`
  SELECT ${row(Account.$$)}
  FROM ${Account}
  WHERE ${Account.$accountId} IN (${expand<{ ids: string[] }>(
    { ids: { minLength: 1 } },
    ({ ids }) => ids.map((id) => sql`${id}`)
  )})
`;

await findByIds.postgres.all({
  db: pool,
  params: { ids: ['id1', 'id2', 'id3'] },
});
```

### Signature

```typescript
expand<Params>(
  validation: { [K in keyof Params]: ParamValidation<Params[K]> | null },
  handler: (params: Params) => Sql | Sql[] | null,
): SqlExpand
```

The validation map declares which params this `expand` consumes. Each key is either `null` (declare the param with no rules) or a `ParamValidation` object. The handler receives the resolved params and returns one SQL node, an array of nodes, or `null` for an empty expansion.

Multiple nodes are joined with `, ` in the output.

### Validation Map

```typescript
// No validation — just declare the param
expand<{ ids: string[] }>({ ids: null }, ({ ids }) => ids.map(id => sql`${id}`))

// With rules — same rule set as param()
expand<{ sort: string }>(
  { sort: { values: ['email', 'created_at'], default: 'created_at' } },
  ({ sort }) => sql`ORDER BY ${raw(sort)}`
)

// Multiple params
expand<{ ids: string[]; sort: string }>(
  { ids: { minLength: 1 }, sort: { values: ['email', 'created_at'], default: 'created_at' } },
  ({ ids, sort }) => [
    sql`${Account.$accountId} IN (${ids.map(id => sql`${id}`)})`,
    sql`ORDER BY ${raw(sort)}`,
  ]
)
```

### Dynamic `ORDER BY`

A common pattern — use `values` to whitelist column names, preventing SQL injection:

```typescript
import { expand, raw, param } from 'vexnor';

const orderBy = param<{ orderBy?: string }>('orderBy', {
  values: ['email', 'created_at', 'first_name'],
  default: 'created_at',
});
const orderDir = param<{ orderDir?: string }>('orderDir', {
  values: ['ASC', 'DESC'],
  default: 'DESC',
});

const selectAccounts = sql`
  SELECT ${row(Account.$$)}
  FROM ${Account}
  ${expand<{ orderBy?: string; orderDir?: string }>(
    { orderBy: orderBy.validation, orderDir: orderDir.validation },
    ({ orderBy, orderDir }) => sql`ORDER BY ${raw(orderBy!)} ${raw(orderDir!)}`
  )}
`;
```

Reusing `.validation` from a named `param()` keeps the rules defined once and shared between both the `param` and the `expand`.

### Params Flow Through Subqueries

Params declared in `expand()` merge into the query's `Params` type, exactly like `param()`. They propagate through nested subqueries:

```typescript
const inner = sql`
  SELECT ${row(Account.$accountId)}
  FROM ${Account}
  WHERE ${Account.$accountId} IN (${expand<{ ids: string[] }>(
    { ids: null },
    ({ ids }) => ids.map(id => sql`${id}`)
  )})
`;
// inner: SqlQuery<{ Row: { accountId: string }, Params: { ids: string[] } }>

const outer = sql`
  SELECT ${row(Account.$$)}
  FROM ${Account}
  WHERE ${Account.$accountId} IN (${inner})
    AND ${Account.$email} = ${param<{ email: string }>('email')}
`;
// outer: SqlQuery<{ Row: IAccountSelect, Params: { ids: string[]; email: string } }>
```

## `ParamsOf<T>` — Infer the Params Type

Use `ParamsOf` to extract the params type from a query without repeating it manually:

```typescript
import { type ParamsOf } from 'vexnor';

export const selectAccounts = sql`...`;

export type SelectAccountsParams = ParamsOf<typeof selectAccounts>;
// { filter?: string; orderBy?: string; orderDir?: string }
```

## Null Normalization

Missing or `undefined` param values are normalized to `null` before SQL binding — omitting an optional param binds as `NULL` rather than throwing.

## Execution Options

Every execution method accepts an optional `options` object alongside `db` and `params`:

```typescript
await query.postgres.all({
  db: pool,
  params: { ... },
  options: {
    timeout: 5000,       // abort after 5 seconds; throws SqlRunError with code QUERY_TIMEOUT
    retryable: false,    // override the plugin's automatic retryable detection
  },
});
```

- `timeout: number` — milliseconds before the query is aborted
- `retryable: "default" | true | false` — `"default"` (or omitted) lets the plugin decide based on driver error codes; `true` always marks the error as retryable; `false` never does
