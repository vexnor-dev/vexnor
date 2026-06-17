# Testing

## Mocking Query Execution

Vexnor queries execute through a `db` connection passed at call time. This makes mocking straightforward — pass a test double instead of a real connection. No mocking framework required.

### Mocking a PostgreSQL query

`PostgresClient` is a simple interface: `{ query(config): Promise<QueryResult> }`. Any object satisfying it works as a mock:

```typescript
import { sql, row } from '@vexnor/core';
import '@vexnor/postgres';
import type { PostgresClient } from '@vexnor/postgres';
import { Account } from './models/account-table.js';

const findAccounts = sql`
  SELECT ${row(Account.$$)}
  FROM ${Account}
`;

const mockDb: PostgresClient = {
  query: async () => ({
    rows: [
      { accountId: '1', email: 'alice@example.com', firstName: 'Alice', lastName: 'Doe', status: 'ACTIVE', createdAt: new Date() },
    ],
  }),
};

const accounts = await findAccounts.postgres.all({ db: mockDb });
// accounts: IAccountSelect[]
```

### Mocking MSSQL

```typescript
import type { Request } from 'mssql';

const mockRequest = {
  query: async () => ({
    recordset: [{ accountId: '1', email: 'alice@example.com' }],
  }),
} as unknown as Request;

const accounts = await findAccounts.mssql.all({ db: mockRequest });
```

### Mocking SQLite

```typescript
import type { Database } from 'better-sqlite3';

const mockDb = {
  prepare: () => ({
    all: () => [{ accountId: '1', email: 'alice@example.com' }],
    run: () => ({ changes: 1 }),
    get: () => ({ accountId: '1', email: 'alice@example.com' }),
  }),
} as unknown as Database;

const accounts = await findAccounts.sqlite.all({ db: mockDb });
```

---

## Mocking via RemoteClient

When using remote execution (browser or cross-service), mock `RemoteClient` instead:

```typescript
import type { RemoteClient } from '@vexnor/core';

const mockRemote: RemoteClient = {
  remoteExecute: async ({ plugin, hash, params }) => ({
    rows: [{ accountId: '1', email: 'alice@example.com' }],
  }),
};

const accounts = await findAccounts.postgres.all({ db: mockRemote });
```

`remoteExecute` receives `{ plugin, hash, params, name, location, mode }` — you can assert on these in your tests to verify the correct query and params are being sent.

---

## Snapshot Testing SQL Output

Use `getSql()` to extract compiled SQL for snapshot testing. Combine with Vitest's `toMatchInlineSnapshot()`:

```typescript
import { describe, test, expect } from 'vitest';
import { sql, row, param } from '@vexnor/core';
import { Account } from './models/account-table.js';

describe('findAccounts', () => {
  const findAccounts = sql`
    SELECT ${row(Account.$$)}
    FROM ${Account}
    WHERE ${Account.$status} = ${param<{ status: string }>('status')}
  `;

  test('generates correct SQL', () => {
    const { text, values } = findAccounts.getSql({ params: { status: 'ACTIVE' } });

    expect(text).toMatchInlineSnapshot();
    expect(values).toMatchInlineSnapshot();
  });
});
```

Run with `vitest -u` to populate the inline snapshots on first run.

---

## Testing React Components

When testing React components that call queries, mock the `remoteClient` module and control what `remoteExecute` returns:

```typescript
import { vi } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { Suspense } from 'react';

vi.mock('#/remote-client.js', () => ({
  remoteClient: { remoteExecute: vi.fn() },
}));

const { remoteClient } = await import('#/remote-client.js');
const { default: AccountsPage } = await import('#/pages/accounts.js');

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(remoteClient.remoteExecute).mockResolvedValue({
    rows: [{ accountId: '1', email: 'alice@example.com', firstName: 'Alice', lastName: 'Doe' }],
  });
});

test('renders accounts', async () => {
  const { asFragment } = await act(async () =>
    render(
      <Suspense fallback={<p>Loading...</p>}>
        <AccountsPage />
      </Suspense>,
    ),
  );
  await waitFor(() => screen.getByText('alice@example.com'));
  expect(asFragment()).toMatchInlineSnapshot();
});
```

Key points:
- Mock the `remoteClient` module before importing the component
- Use `vi.clearAllMocks()` in `beforeEach` to reset call counts between tests
- Wrap `render` in `act(async () => ...)` so React's Suspense boundary resolves before assertions
- Use `asFragment()` + `toMatchInlineSnapshot()` to snapshot the full rendered DOM

### Asserting the correct query was called

```typescript
test('calls remoteExecute with correct plugin', async () => {
  await act(async () => render(<Suspense fallback={null}><AccountsPage /></Suspense>));
  await waitFor(() => screen.getByText('alice@example.com'));

  expect(vi.mocked(remoteClient.remoteExecute)).toHaveBeenCalledWith(
    expect.objectContaining({ plugin: '@vexnor/postgres' }),
  );
});
```

### Testing mutations

For insert/delete/update, the mock returns whatever the DB would return. Assert that `remoteExecute` was called the expected number of times (initial load + mutation + refresh):

```typescript
test('delete refreshes the list', async () => {
  const user = userEvent.setup();
  await act(async () => render(<Suspense fallback={null}><AccountsPage /></Suspense>));
  await waitFor(() => screen.getByText('alice@example.com'));

  await user.click(screen.getAllByText('Delete')[0]!);

  await waitFor(() =>
    expect(vi.mocked(remoteClient.remoteExecute)).toHaveBeenCalledTimes(3),
    // 1: initial select, 2: delete run, 3: refresh select
  );
});
```

---

## Testing SqlQueryRegistry

Test authorization and audit logging by creating a registry in your test:

```typescript
import { describe, test, expect, vi } from 'vitest';
import { SqlQueryRegistry, AuditLogPlugin } from '@vexnor/core/execution';
import vexnorPostgres from '@vexnor/postgres';

describe('SqlQueryRegistry authorization', () => {
  test('denies unauthorized queries', async () => {
    const registry = new SqlQueryRegistry<{ roles: string[] }>();
    registry.registerAuthorization(({ query, context }) => {
      if (!query.authorization.every(tag => context.roles.includes(tag))) {
        throw new Error('Forbidden');
      }
    });

    await registry.register(vexnorPostgres, { deleteAccount });

    await expect(
      registry.execute(
        { plugin: '@vexnor/postgres', hash: await deleteAccount.hash, params: {}, mode: 'write', location: null, name: 'deleteAccount' },
        async () => pool,
        { roles: ['viewer'] },
      ),
    ).rejects.toThrow('Forbidden');
  });
});
```

### Testing Audit Log

```typescript
test('audit log fires on execution', async () => {
  const onLog = vi.fn();
  const registry = new SqlQueryRegistry();
  registry.use(new AuditLogPlugin({ onLog }));

  await registry.register(vexnorPostgres, { findAccounts });

  await registry.execute(
    { plugin: '@vexnor/postgres', hash: await findAccounts.hash, params: {}, mode: 'read', location: null, name: 'findAccounts' },
    async () => mockDb,
  );

  expect(onLog).toHaveBeenCalledWith(
    expect.objectContaining({
      name: 'findAccounts',
      durationMs: expect.any(Number),
      error: null,
    }),
  );
});
```

---

## Testing with `connect()` and Pipelines

```typescript
import { connect } from '@vexnor/core';
import { SqlQueryPipeline } from '@vexnor/core/execution';

test('pipeline fires authorization on direct execution', async () => {
  const pipeline = new SqlQueryPipeline<{ Context: { roles: string[] } }>();
  pipeline.registerAuthorization(({ query, context }) => {
    if (!query.authorization.every(tag => context.roles.includes(tag))) throw new Error('Forbidden');
  });

  const db = connect(mockDb, { pipeline });

  await expect(
    deleteAccount.postgres.run({ db, params: { accountId: '1', roles: ['viewer'] } }),
  ).rejects.toThrow('Forbidden');
});
```

---

## Integration Testing

For full integration tests against a real database, use the same pattern as production — just point at a test database:

```typescript
import { Pool } from 'pg';
import { transaction } from '@vexnor/postgres';

const testPool = new Pool({ connectionString: process.env.TEST_DATABASE_URL });

afterAll(() => testPool.end());

test('inserts and retrieves an account', async () => {
  await transaction(testPool, async (client) => {
    const inserted = await Account.postgres.insertRows().one({
      db: client,
      params: { rows: [{ email: 'test@example.com', firstName: 'Test', lastName: 'User' }] },
    });

    expect(inserted.email).toBe('test@example.com');

    const found = await Account.postgres.findBy().any({
      db: client,
      params: { email: 'test@example.com' },
    });

    expect(found).toMatchObject({ email: 'test@example.com' });
  });
  // Transaction rolls back by throwing at the end, or use a test harness that wraps in transactions
});
```

---

## Best Practices

- Use `toMatchInlineSnapshot()` for all SQL text and values output — never hardcode expected SQL strings
- Write tests with empty `toMatchInlineSnapshot()` calls first, then populate by running with `vitest -u`
- Mock at the connection level (`db`), not at the query level — this tests the full query building pipeline
- For React components, always mock at the `remoteClient` module level
- Use `vi.clearAllMocks()` in `beforeEach` to prevent state leakage between tests
- Prefer `asFragment()` over `container.innerHTML` for DOM snapshots
