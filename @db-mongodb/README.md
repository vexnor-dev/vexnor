# @db-mongodb

MongoDB seed data for local development and examples.

## Prerequisites

```bash
docker run -d --name vexnor-mongo --restart unless-stopped \
  -p 27017:27017 -v vexnor-mongo-data:/data/db mongo:7
```

## Seed the database

```bash
pnpm db-seed:mongodb
```

Generates realistic demo data at the same scale as the Postgres/MSSQL/SQLite test fixtures:

| Collection | Documents | Embedded | Pattern |
|---|---|---|---|
| `accounts` | 400 | — | 100 root + 300 children (3 per root). Nested name, nullable parent ref, enum status |
| `products` | 20 | — | Nullable nested metadata (dimensions, colors, brand), scalar array (tags) |
| `orders` | 800 | 1600 items | 2 per account. Embedded items array with denormalized product data |

## Indexes

- `accounts.email` (unique)
- `accounts.status`
- `accounts.parent.accountId`
- `accounts.createdAt` (descending)
- `orders.accountId`
- `orders.status`
- `orders.createdAt` (descending)
- `orders.items.productId`
- `products.tags`
- `products.availability` (compound)
- `products.price`
