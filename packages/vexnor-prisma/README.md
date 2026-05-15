# vexnor-prisma

Prisma adaptor for Vexnor.

It converts Prisma model metadata (`PrismaModel`) into Vexnor runtime tables/views.

## Install

```bash
pnpm add vexnor vexnor-prisma @prisma/client
```

## When to Use

Recommended path for long-term production stability:
1. Generate DB mappings with Vexnor CLI.
2. Keep adaptor-based ORM integration as migration/onramp.

Use `vexnor-prisma` when you already have Prisma models and want to adopt Vexnor incrementally.

## Core Flow

1. Resolve a Prisma model into `PrismaModel` using `findPrismaModel(...)`.
2. Build table/view with `fromPrismaModelTable(...)` / `fromPrismaModelView(...)`.
3. Use resulting Vexnor table in SQL/CRUD.

## Resolve Prisma Models

`findPrismaModel` supports three explicit inputs:

```ts
type FindPrismaModelOptions =
  | { dmmf: { datamodel?: { models?: readonly PrismaModel[] } } }
  | { schemaPath: string }
  | { schema: string };
```

### Option A: Use `dmmf` from generated Prisma code

Best when your generated client exposes `Prisma.dmmf` (common with `prisma-client-js`):

```ts
import { findPrismaModel } from "vexnor-prisma";
import { Prisma } from "@prisma/client";

const accountModel = await findPrismaModel("Account", { dmmf: Prisma.dmmf });
```

### Option B: Use `schemaPath`

Best for Prisma v7 + `prisma-client` setups:

```ts
import { findPrismaModel } from "vexnor-prisma";

const accountModel = await findPrismaModel("Account", {
  schemaPath: "./prisma/schema.prisma",
});
```

### Option C: Use in-memory `schema` string

```ts
import { readFile } from "node:fs/promises";
import { findPrismaModel } from "vexnor-prisma";

const schema = await readFile("./prisma/schema.prisma", "utf8");
const accountModel = await findPrismaModel("Account", { schema });
```

## Build Vexnor Table/View

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

const AccountTable = fromPrismaModelTable<AccountSelect, AccountInsert, AccountUpdate>(accountModel, {
  provider: "postgresql",
  schema: "vexnor_dev",
});

const AccountView = fromPrismaModelView<AccountSelect>(accountModel, {
  provider: "postgresql",
  schema: "vexnor_dev",
});
```

## End-to-End Example (Existing Prisma Setup)

```ts
import { findPrismaModel, fromPrismaModelTable } from "vexnor-prisma";
import type { Prisma as PrismaTypes } from "@prisma/client";
import { sql, row, col } from "vexnor";

const accountModel = await findPrismaModel("Account", { schemaPath: "./prisma/schema.prisma" });
const orderModel = await findPrismaModel("Order", { schemaPath: "./prisma/schema.prisma" });
const orderItemModel = await findPrismaModel("OrderItem", { schemaPath: "./prisma/schema.prisma" });

const Account = fromPrismaModelTable<
  PrismaTypes.Account,
  PrismaTypes.AccountUncheckedCreateInput,
  PrismaTypes.AccountUncheckedUpdateInput
>(accountModel, { provider: "postgresql", schema: "vexnor_dev" });

const Order = fromPrismaModelTable<
  PrismaTypes.Order,
  PrismaTypes.OrderUncheckedCreateInput,
  PrismaTypes.OrderUncheckedUpdateInput
>(orderModel, { provider: "postgresql", schema: "vexnor_dev" });

const OrderItem = fromPrismaModelTable<
  PrismaTypes.OrderItem,
  PrismaTypes.OrderItemUncheckedCreateInput,
  PrismaTypes.OrderItemUncheckedUpdateInput
>(orderItemModel, { provider: "postgresql", schema: "vexnor_dev" });

const query = sql`
  SELECT
    ${row(Account.$$)},
    COUNT(${OrderItem.$productId}) AS ${col<{ orderCount: number }>("orderCount")},
    COALESCE(SUM(${OrderItem.$quantity}), 0) AS ${col<{ totalQuantity: number }>("totalQuantity")}
  FROM ${Account}
  LEFT JOIN ${Order} ON ${Order.$accountId} = ${Account.$accountId}
  LEFT JOIN ${OrderItem} ON ${OrderItem.$orderId} = ${Order.$orderId}
  WHERE ${Account.$status} = 'created'
  GROUP BY ${Account.$accountId}, ${Account.$email}, ${Account.$firstName}, ${Account.$lastName}
`;
```

## API

- `findPrismaModel(modelName, options)`
- `fromPrismaModelTable<TSelect, TInsert, TUpdate>(model, options?)`
- `fromPrismaModelView<TSelect>(model, options?)`

`fromPrismaModel*` options:
- `provider`: Prisma provider name (`postgresql`, `sqlserver`, `sqlite`, ...)
- `dialect`: explicit Vexnor dialect override
- `schema`: SQL schema override for `tableInfo`

## Version/Generator Guidance

- Prisma v6 + `prisma-client-js`: usually easiest via `{ dmmf: Prisma.dmmf }`.
- Prisma v7 + `prisma-client`: usually easiest via `{ schemaPath }`.
- Prisma v7 + `prisma-client-js`: both approaches can work; prefer one stable approach per codebase.

## Notes

- `findPrismaModel` uses `@prisma/internals` for schema-based resolution (`schemaPath` / `schema`).
- Keep Prisma schema and generated code in sync before build/test.
