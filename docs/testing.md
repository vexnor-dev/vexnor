# Testing

## Mocking Query Execution

Vexnor queries execute through a `db` connection passed at call time. This makes mocking straightforward — pass a test double instead of a real connection. No mocking framework required.

### Mocking a PostgreSQL query

`PostgresClient` is a simple interface: `{ query(config): Promise<QueryResult> }`. Any object satisfying it works as a mock:

```typescript
import { sql, row } from 'vexnor';
import 'vexnor-postgres';
import type { PostgresClient } from 'vexnor-postgres';
import { Account } from './models/account-table.js';

const findAccounts = sql`
  SELECT ${row(Account.$$)}
  FROM ${Account}
`;

const mockDb: PostgresClient = {
  query: async () => ({
    rows: [
      { accountId: '1', email: 'alice@example.com', firstName: 'Alice', ... },
    ],
  }),
};

const accounts = await findAccounts.postgres.all({ db: mockDb });
// accounts: IAccountSelect[]
```

### Mocking via RemoteClient

When using remote execution (browser or cross-service), mock `RemoteClient` instead:

```typescript
import type { RemoteClient } from 'vexnor';

const mockRemote: RemoteClient = {
  remoteExecute: async ({ plugin, hash, params }) => ({
    rows: [{ accountId: '1', email: 'alice@example.com', ... }],
  }),
};

const accounts = await findAccounts.postgres.all({ db: mockRemote });
```

`remoteExecute` receives `{ plugin, hash, params }` — you can assert on these in your tests to verify the correct query and params are being sent.

### Testing React components

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
    rows: [{ accountId: '1', email: 'alice@example.com', ... }],
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
    expect.objectContaining({ plugin: 'vexnor-postgres' }),
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
