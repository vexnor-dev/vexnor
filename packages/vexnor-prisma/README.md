# vexnor-prisma

Prisma adaptor for Vexnor.

Converts Prisma DMMF `PrismaModel` objects into Vexnor runtime tables/views.

## Install

```bash
pnpm add vexnor vexnor-prisma @prisma/client
```

## Recommended Usage Strategy

1. Preferred: generate DB mapping code with Vexnor CLI.
2. Alternative: use `vexnor-prisma` to start from an existing Prisma setup and migrate incrementally.

Using Prisma metadata directly is convenient for adoption, but Prisma contracts can evolve across versions.
For long-term stability, treat CLI-generated mappings as the primary production path.

## Start from Existing Prisma Setup

This adaptor assumes you already have:
- a working `schema.prisma`
- generated Prisma client code
- Prisma model names you want to map to Vexnor

### 1) Generate Prisma client

```bash
pnpm exec prisma generate
```

For this package test fixtures:

```bash
pnpm --filter vexnor-prisma run codegen:prisma:v6
pnpm --filter vexnor-prisma run codegen:prisma:v7
```

### 2) Resolve a Prisma model from generated metadata

```ts
import { Prisma } from "@prisma/client";

const accountModel = Prisma.dmmf.datamodel.models.find((m) => m.name === "Account");
if (!accountModel) throw new Error("Account model not found");
```

### 3) Build Vexnor table/view with strong types

```ts
import { fromPrismaModelTable, fromPrismaModelView } from "vexnor-prisma";
import type { Account, Prisma as PrismaTypes } from "@prisma/client";

type AccountSelect = Account;
type AccountInsert = Pick<
  PrismaTypes.AccountUncheckedCreateInput,
  "accountId" | "email" | "firstName" | "lastName"
>;
type AccountUpdate = Pick<
  PrismaTypes.AccountUncheckedUpdateInput,
  "accountId" | "email" | "firstName" | "lastName"
>;

const Account = fromPrismaModelTable<AccountSelect, AccountInsert, AccountUpdate>(accountModel, {
  provider: "postgresql",
  schema: "vexnor_dev",
});

const AccountView = fromPrismaModelView<AccountSelect>(accountModel, {
  provider: "postgresql",
  schema: "vexnor_dev",
});
```

### 4) Use resulting tables in complex Vexnor queries

```ts
import { sql, row, val, col } from "vexnor";

const orderItemModel = Prisma.dmmf.datamodel.models.find((m) => m.name === "OrderItem");
const orderModel = Prisma.dmmf.datamodel.models.find((m) => m.name === "Order");
if (!orderItemModel) throw new Error("OrderItem model not found");
if (!orderModel) throw new Error("Order model not found");

type OrderItemSelect = PrismaTypes.OrderItemUncheckedCreateInput & {
  quantity: number;
};
type OrderItemInsert = PrismaTypes.OrderItemUncheckedCreateInput;
type OrderItemUpdate = PrismaTypes.OrderItemUncheckedUpdateInput;

const OrderItem = fromPrismaModelTable<OrderItemSelect, OrderItemInsert, OrderItemUpdate>(orderItemModel, {
  provider: "postgresql",
  schema: "vexnor_dev",
});
const Order = fromPrismaModelTable<
  PrismaTypes.Order,
  PrismaTypes.Prisma.OrderUncheckedCreateInput,
  PrismaTypes.Prisma.OrderUncheckedUpdateInput
>(orderModel, {
  provider: "postgresql",
  schema: "vexnor_dev",
});

const listAccountsWithOrderStats = sql`
  SELECT
    ${row(Account.$$)},
    COUNT(${OrderItem.$productId}) AS ${col<{ orderCount: number }>("orderCount")},
    COALESCE(SUM(${OrderItem.$quantity}), ${val(0)}) AS ${col<{ totalQuantity: number }>("totalQuantity")}
  FROM ${Account}
  LEFT JOIN ${Order} ON ${Order.$accountId} = ${Account.$accountId}
  LEFT JOIN ${OrderItem} ON ${OrderItem.$orderId} = ${Order.$orderId}
  WHERE ${Account.$status} = ${val("created")}
  GROUP BY ${Account.$accountId}, ${Account.$email}, ${Account.$firstName}, ${Account.$lastName}
  ORDER BY ${Account.$email}
`;

const rows = await listAccountsWithOrderStats.postgres.all({ db: pool });
```

## API

- `fromPrismaModelTable<TSelect, TInsert, TUpdate>(model, options?)`
- `fromPrismaModelView<TSelect>(model, options?)`

Options:
- `provider`: Prisma provider name (`postgresql`, `sqlserver`, `sqlite`, ...)
- `dialect`: explicit Vexnor dialect override
- `schema`: SQL schema override for tableInfo

## Notes

- This package is model-metadata based and does not parse schema files at runtime.
- Keep Prisma code generated before build/test so `Prisma.dmmf` is available.
