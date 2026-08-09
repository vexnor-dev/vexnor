# MongoDB

`@vexnor/mongodb` — driver-typed queries with strict type-safe filters, registry integration, and isomorphic execution.

## Install

```bash
npm install @vexnor/core @vexnor/mongodb mongodb
```

## Architecture

Unlike SQL plugins which use template literals and module augmentation (`.postgres.all()`), the MongoDB plugin uses the driver's own type system for query construction. Queries execute directly via `.all()` / `.one()` / `.any()` — no namespace accessor needed.

The same isomorphic security model applies: client sends hash + params via `HttpRemoteClient`, server resolves via `MongoQueryRegistry`, executes against the driver. Client never constructs arbitrary filters at runtime.

## Collection Definition

```typescript
import { collection } from '@vexnor/mongodb';

interface Order {
  _id: string;
  accountId: string;
  status: 'pending' | 'shipped' | 'delivered';
  shipping: {
    address: { street: string; city: string; country: string };
    carrier: { name: string; trackingId: string };
  };
  items: { productId: string; name: string; qty: number; price: number }[];
  createdAt: Date;
}

const orders = collection<Order>('orders', {
  source: '@myapp/api:events',
  schema: {
    _id: 'string',
    accountId: 'string',
    status: 'string',
    shipping: {
      address: { street: 'string', city: 'string', country: 'string' },
      carrier: { name: 'string', trackingId: 'string' },
    },
    items: [{ productId: 'string', name: 'string', qty: 'integer', price: 'number' }],
    createdAt: 'date',
  },
});
```

### Schema Descriptor

| Descriptor | TypeScript | Purpose |
|---|---|---|
| `'string'` | `string` | String/ObjectId field |
| `'number'` | `number` | Float/double |
| `'integer'` | `number` | Integer |
| `'boolean'` | `boolean` | Boolean |
| `'date'` | `Date` | Date/timestamp |
| `{ ... }` | `{ ... }` | Nested object |
| `[{ ... }]` | `T[]` | Array of objects |
| `['string']` | `string[]` | Array of scalars |

### Source Identity

The `source` field identifies which database connection this collection belongs to — same purpose as SQL table `source`. Used by the registry for validation and manifest generation.

## Queries

### find

```typescript
import { param, ctx } from '@vexnor/core';

// Literal filter
const findShipped = orders.find({ status: 'shipped' });

// Parameterized
const findByStatus = orders.find(
  { status: param<{ status: string }>('status') },
  { sort: { createdAt: -1 }, limit: param<{ limit: number }>('limit') },
);

// Context value (server-injected, never client-supplied)
const findMyOrders = orders.find({ accountId: ctx<{ userId: string }>('userId') });

// Dot-path queries on nested fields
const findByCountry = orders.find({ 'shipping.address.country': 'US' });
const findExpensive = orders.find({ 'items.price': { $gt: 100 } });
```

### aggregate

```typescript
// Simple pipeline
const ordersByCountry = orders.aggregate<{ _id: string; count: number }>([
  { $match: { status: 'delivered' } },
  { $group: { _id: '$shipping.address.country', count: { $sum: 1 } } },
  { $sort: { count: -1 } },
]);

// $lookup with typed collection reference
const ordersWithAccount = orders.aggregate([
  { $lookup: { from: accounts, localField: 'accountId', foreignField: '_id', as: 'account' } },
]);

// $unwind + computed fields
const itemRevenue = orders.aggregate<{ _id: string; revenue: number }>([
  { $unwind: '$items' },
  { $group: { _id: '$items.productId', revenue: { $sum: { $multiply: ['$items.qty', '$items.price'] } } } },
  { $sort: { revenue: -1 } },
]);
```

### Mutations

```typescript
const deleteOrder = orders.deleteOne({ _id: param<{ id: string }>('id') });
const insertOrder = orders.insertOne(param<{ doc: Order }>('doc'));
const updateStatus = orders.updateOne(
  { _id: param<{ id: string }>('id') },
  { $set: { status: param<{ status: string }>('status') } },
);

// Bulk
const deleteOld = orders.deleteMany({ status: 'delivered', createdAt: { $lt: cutoffDate } });
const insertBatch = orders.insertMany(param<{ docs: Order[] }>('docs'));
const updateAll = orders.updateMany(
  { status: 'pending' },
  { $set: { status: 'cancelled' } },
);
```

## Execution

```typescript
import { MongoClient } from 'mongodb';

const client = new MongoClient(process.env.MONGODB_URI!);
const db = client.db('myapp');

// .all() — all results
const results = await findByStatus.all({ db, params: { status: 'shipped', limit: 20 } });

// .one() — exactly one (throws otherwise)
const order = await findByStatus.one({ db, params: { status: 'shipped', limit: 1 } });

// .any() — first result or undefined
const maybe = await findByStatus.any({ db, params: { status: 'shipped', limit: 1 } });
```

### Isomorphic (Client-Side)

```typescript
import { HttpRemoteClient } from '@vexnor/core';

const remoteClient = new HttpRemoteClient({ targetUrl: '/api/db' });

// Same query, same API — dispatched by hash to the server
const results = await findByStatus.all({ db: remoteClient, params: { status: 'shipped', limit: 20 } });
```

## Strict Type-Safe Filters

### Dot-Path Notation

`DotPaths<T>` generates all valid dot-path strings from the document type at compile time:

```typescript
// ✅ Valid paths — autocomplete works
orders.find({ 'shipping.address.country': 'US' });
orders.find({ 'shipping.carrier.name': { $regex: /^Fed/ } });
orders.find({ 'items.productId': 'prod-1' });

// ❌ Compile error — invalid path
orders.find({ 'shipping.nonExistent': 'x' });
```

### Typed Operators

Operator values are constrained to match the field type:

```typescript
// ✅ $gt accepts number for a number field
orders.find({ 'items.price': { $gt: 50 } });

// ✅ $in accepts array of the field type
orders.find({ status: { $in: ['shipped', 'delivered'] } });

// ✅ $regex only valid on string fields
orders.find({ 'shipping.carrier.name': { $regex: /^Fed/ } });

// ✅ $elemMatch with typed element fields
orders.find({ items: { $elemMatch: { qty: { $gt: 5 }, price: { $lt: 100 } } } });

// ✅ Array field accepts single element (containment match)
orders.find({ 'items.name': 'Widget Pro' });

// ❌ Compile error — $gt expects number
orders.find({ 'items.price': { $gt: 'fifty' } });
```

### Logical Operators

```typescript
orders.find({
  $or: [
    { status: 'shipped' },
    { 'shipping.address.country': { $in: ['US', 'DE'] } },
  ],
});

orders.find({
  $and: [
    { 'items.price': { $gte: 10 } },
    { 'items.qty': { $lte: 100 } },
  ],
});
```

## Hash Derivation

Hashes are derived from canonical JSON serialization of the operation descriptor:

```json
{
  "collection": "orders",
  "operation": "find",
  "filter": { "status": { "$param": "status" } },
  "sort": { "createdAt": -1 },
  "limit": { "$param": "limit" }
}
```

- Literal values → `{ "$literal": "shipped" }`
- Params → `{ "$param": "status" }`
- Context → `{ "$ctx": "userId" }`
- Keys are sorted (canonical JSON) for deterministic hashing regardless of object key order

## Registry Integration

```typescript
import { MongoQueryRegistry } from '@vexnor/mongodb';

const registry = new MongoQueryRegistry<AppContext>();
await registry.register({ findByStatus, findMyOrders, deleteOrder, ordersByCountry });

// Server endpoint
app.post('/api/db', async (c) => {
  const { plugin, hash, params, mode } = await c.req.json();
  if (plugin === '@vexnor/mongodb') {
    const result = await registry.execute({ hash, params, mode }, db, context);
    return c.json(result);
  }
});
```

## Codegen

Generate typed collection definitions from an existing database:

```bash
npx vexnor codegen \
  --plugin @vexnor/mongodb \
  --uri $MONGODB_URI \
  --db myapp \
  --outDir src/models \
  --sampleSize 1000
```

### Schema Discovery Priority

| Source | When used |
|---|---|
| JSON Schema validator | If a `$jsonSchema` validator is defined on the collection |
| Document sampling | Fallback — samples N documents and infers merged schema |

### Output

```typescript
// Generated by @vexnor/mongodb codegen — do not edit
import { collection } from '@vexnor/mongodb';

export interface IOrder { ... }

export const Order = collection<IOrder>('orders', {
  source: '@myapp/api:src/models',
  schema: { ... },
});
```

## Cross-Runtime Support (Go, .NET)

MongoDB queries support execution from Go and .NET via the manifest pattern:

```typescript
import { serializeMongoManifest } from '@vexnor/mongodb';

const manifest = await serializeMongoManifest({ findByStatus, ordersByCountry });
```

### Go

```go
import "github.com/vexnor-dev/vexnor/stacks/golang/mongodb"

executor, _ := mongodb.NewFromURI(ctx, uri, "myapp")
results, _ := executor.QueryRows(ctx, descriptor, params)
```

### .NET

```csharp
using Vexnor.MongoDB;

var executor = MongoDbExecutor.FromUri(uri, "myapp");
var results = await executor.QueryRowsAsync(descriptor, parameters);
```

## Authorization

```typescript
const adminQuery = orders.find({ status: 'pending' }).authorize('admin');
```

## Typed Collection Refs in $lookup

Instead of string collection names, pass the collection object for type safety:

```typescript
// Typed — compiler validates foreignField exists on Account
{ $lookup: { from: Accounts, localField: 'accountId', foreignField: '_id', as: 'account' } }

// String — still works, no type checking on foreignField
{ $lookup: { from: 'accounts', localField: 'accountId', foreignField: '_id', as: 'account' } }
```

Both forms are supported in parallel. Collection refs resolve to their string name at runtime.

## Local Development

```bash
# Start MongoDB
docker run -d --name vexnor-mongo --restart unless-stopped \
  -p 27017:27017 -v vexnor-mongo-data:/data/db mongo:7

# Seed demo data (400 accounts, 20 products, 800 orders)
pnpm db-seed:mongodb
```

## Limitations

- **Aggregation pipelines** are untyped `Document[]` — per-stage type inference is not supported by the MongoDB driver or any library. Provide the result type via generic: `aggregate<ResultType>([...])`
- **DotPaths depth limit**: recurses to depth 5 to prevent infinite types on recursive documents
- **No transaction support** in v1 (MongoDB multi-document transactions are a future enhancement)
