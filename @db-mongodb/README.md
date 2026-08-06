# @db-mongodb

MongoDB seed data for local development and examples.

## Prerequisites

```bash
docker compose up -d mongo
```

## Seed the database

```bash
pnpm db-seed:mongodb
```

This creates collections (accounts, products, orders) with JSON Schema validators
and populates them with realistic demo data matching the same entity patterns used
in the Postgres/MSSQL/SQLite3 examples.

## Collections

| Collection | Documents | Pattern |
|---|---|---|
| `accounts` | 6 | Nested object (name), nullable nested (parent), enum status |
| `products` | 5 | Nullable nested metadata with dimensions/colors, scalar array (tags) |
| `orders` | 6 | Embedded array of items (denormalized), cross-collection ref (accountId) |

## Indexes

- `accounts.email` (unique)
- `accounts.status`
- `orders.accountId`
- `orders.status`
- `products.tags`
- `products.availability.isAvailable`
