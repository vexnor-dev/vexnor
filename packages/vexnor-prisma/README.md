# vexnor-prisma

Prisma adaptor for Vexnor.

Converts Prisma DMMF `PrismaModel` objects into Vexnor runtime tables/views.

```ts
import { Prisma } from "@prisma/client";
import { fromPrismaModelTable } from "vexnor-prisma";

type AccountSelect = {
  accountId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
};

type AccountInsert = {
  accountId?: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
};

type AccountUpdate = {
  accountId?: string;
  email?: string;
  firstName?: string | null;
  lastName?: string | null;
};

const accountModel = Prisma.dmmf.datamodel.models.find((m) => m.name === "Account");
if (!accountModel) throw new Error("Account model not found");

const Account = fromPrismaModelTable<AccountSelect, AccountInsert, AccountUpdate>(accountModel, {
  provider: "postgresql",
  schema: "vexnor_dev",
});

// IntelliSense:
// Account.$email
// Account.postgres.findById()
```
