# @vexnor/mongodb

MongoDB plugin for Vexnor — driver-typed queries with strict type-safe filters, registry integration, and isomorphic execution.

## Install

```bash
npm install @vexnor/core @vexnor/mongodb mongodb
```

## Collection Definition

Define a typed collection with an explicit runtime schema descriptor:

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

## Queries

### find

```typescript
import { param, ctx } from '@vexnor/core';

// Literal filter
const findShipped = orders.find({ status: 'shipped' });

// Parameterized — caller supplies value at execution time
const findByStatus = orders.find(
  { status: param<{ status: string }>('status') },
  { sort: { createdAt: -1 }, limit: param<{ limit: number }>('limit') },
);

// Context value — server injects from session, never client-supplied
const findMyOrders = orders.find({ accountId: ctx<{ userId: string }>('userId') });
```

### aggregate

```typescript
const ordersByCountry = orders.aggregate<{ _id: string; count: number }>([
  { $match: { status: 'delivered' } },
  { $group: { _id: '$shipping.address.country', count: { $sum: 1 } } },
  { $sort: { count: -1 } },
]);

// $lookup with typed collection reference (refactoring-safe)
const ordersWithAccount = orders.aggregate([
  { $lookup: { from: accounts, localField: 'accountId', foreignField: '_id', as: 'account' } },
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
```

## Execution

Queries execute directly — no namespace needed (unlike SQL plugins which use `.postgres`, `.mssql`, etc.):

```typescript
import { MongoClient } from 'mongodb';

const client = new MongoClient(process.env.MONGODB_URI);
const db = client.db('myapp');

// .all() — returns all results
const results = await findByStatus.all({ db, params: { status: 'shipped', limit: 20 } });

// .one() — returns exactly one, throws otherwise
const order = await findShipped.one({ db });

// .any() — returns first result or undefined
const maybe = await findShipped.any({ db });
```

### Isomorphic (client-side via RemoteClient)

```typescript
import { HttpRemoteClient } from '@vexnor/core';

const remoteClient = new HttpRemoteClient({ targetUrl: '/api/db' });

// Same query, same API — dispatched by hash to the server
const results = await findByStatus.all({ db: remoteClient, params: { status: 'shipped', limit: 20 } });
```

## Strict Type-Safe Filters

### Dot-Path Notation

Filters are type-checked at compile time — invalid field paths are rejected:

```typescript
// ✅ Valid — resolves through nested objects
orders.find({ 'shipping.address.country': 'US' });

// ✅ Valid — array element field paths
orders.find({ 'items.productId': 'prod-1' });

// ✅ Valid — scalar array containment
orders.find({ 'items.name': { $in: ['Widget', 'Gadget'] } });

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

// ❌ Compile error — $gt expects number, got string
orders.find({ 'items.price': { $gt: 'fifty' } });
```

### Logical Operators

```typescript
orders.find({
  $or: [
    { status: 'shipped' },
    { 'shipping.address.country': 'US' },
  ],
});
```

## Registry Integration

```typescript
import { MongoQueryRegistry } from '@vexnor/mongodb';

const registry = new MongoQueryRegistry<{ token: string | null }>();
await registry.register({ findByStatus, findMyOrders, deleteOrder });

// Execute by hash (same security model as SQL — client sends hash + params)
const result = await registry.execute(
  { hash, params: { status: 'shipped' }, mode: 'read' },
  db,
  { token: request.headers.authorization },
);
```

## Codegen

Generate typed collection definitions from an existing MongoDB database:

```bash
npx vexnor codegen \
  --plugin @vexnor/mongodb \
  --uri $MONGODB_URI \
  --db myapp \
  --outDir src/models \
  --sampleSize 1000
```

### Schema Discovery

| Source | When used |
|---|---|
| JSON Schema validator | If a `$jsonSchema` validator is defined on the collection |
| Document sampling | Fallback — samples N documents and infers merged schema |

### Output

```typescript
// Generated by @vexnor/mongodb codegen — do not edit
import { collection } from '@vexnor/mongodb';

export interface IOrder { /* ... */ }

export const Order = collection<IOrder>('orders', {
  source: '@myapp/api:src/models',
  schema: { /* ... */ },
});
```

## Cross-Runtime Support

MongoDB queries support execution from Go and .NET via the manifest pattern:

```typescript
import { serializeMongoManifest } from '@vexnor/mongodb';

const manifest = await serializeMongoManifest({ findByStatus, ordersByCountry });
writeFileSync('manifest.json', JSON.stringify(manifest, null, 2));
```

The manifest contains operation descriptors that Go (`stacks/golang/mongodb/`) and .NET (`stacks/dotnet/src/Vexnor.MongoDB/`) executors consume to run the same queries with their native MongoDB drivers.

## Schema Descriptor Convention

| Descriptor | TypeScript | Purpose |
|---|---|---|
| `'string'` | `string` | String/ObjectId field |
| `'number'` | `number` | Float/double field |
| `'integer'` | `number` | Integer field |
| `'boolean'` | `boolean` | Boolean field |
| `'date'` | `Date` | Date/timestamp field |
| `{ ... }` | `{ ... }` | Nested object |
| `[{ ... }]` | `T[]` | Array of objects |
| `['string']` | `string[]` | Array of scalars |

## Authorization

```typescript
const adminOnly = orders.find({ status: 'pending' }).authorize('admin');
```

## Local Development

```bash
# Start MongoDB
docker run -d --name vexnor-mongo --restart unless-stopped \
  -p 27017:27017 -v vexnor-mongo-data:/data/db mongo:7

# Seed with demo data (400 accounts, 20 products, 800 orders)
pnpm db-seed:mongodb
```
