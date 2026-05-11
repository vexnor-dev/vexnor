import { describe, expect, test } from "vitest";
import { SqlTable, SqlTableColumn, col, row, sql } from "vexnor";
import { fromPrismaModelTable, fromPrismaModelView } from "../from-prisma-model.js";
import { getDialectFromPrismaProvider } from "../dialect.js";
import { PrismaModel } from "../prisma-dmmf-types.js";

type Fixture = {
   tag: "v6" | "v7";
   loadModels: () => Promise<readonly PrismaModel[]>;
};

async function loadV6Models(): Promise<readonly PrismaModel[]> {
   const generated = await import("./fixtures-v6/generated/index.js");
   const models = generated?.Prisma?.dmmf?.datamodel?.models as readonly PrismaModel[] | undefined;
   if (!models) throw new Error("Prisma v6 dmmf models not found in generated client.");
   return models;
}

type V7RuntimeDataModel = {
   models: Record<string, { dbName?: string | null; fields: PrismaModel["fields"] }>;
};

async function loadV7Models(): Promise<readonly PrismaModel[]> {
   const classModule = (await import("./fixtures-v7/generated/internal/class.ts?raw")) as { default: string };
   const source = classModule.default;
   const match = source.match(/config\.runtimeDataModel\s*=\s*JSON\.parse\("(.+?)"\)/s);
   if (!match?.[1]) throw new Error("Prisma v7 runtimeDataModel JSON not found.");
   const runtimeDataModel = JSON.parse(JSON.parse(`"${match[1]}"`)) as V7RuntimeDataModel;

   return Object.entries(runtimeDataModel.models).map(([name, model]) => ({
      name,
      dbName: model.dbName ?? null,
      fields: model.fields,
   }));
}

function findModel(models: readonly PrismaModel[], modelName: string): PrismaModel {
   const model = models.find((m) => m.name === modelName);
   if (!model) throw new Error(`Model not found: ${modelName}`);
   return model;
}

const FIXTURES: Fixture[] = [
   { tag: "v6", loadModels: loadV6Models },
   { tag: "v7", loadModels: loadV7Models },
];

describe("vexnor-prisma client", () => {
   test("provider to dialect mapping", () => {
      expect(getDialectFromPrismaProvider("postgresql")).toBe("postgresql");
      expect(getDialectFromPrismaProvider("sqlserver")).toBe("tsql");
      expect(getDialectFromPrismaProvider("sqlite")).toBe("sqlite");
   });
});

for (const fixture of FIXTURES) {
   describe(`vexnor-prisma client (${fixture.tag})`, () => {
      test("fromPrismaModelTable returns SqlTable with expected columns", async () => {
         const models = await fixture.loadModels();
         const accountModel = findModel(models, "Account");
         const Account = fromPrismaModelTable<Record<string, unknown>, Record<string, unknown>, Record<string, unknown>>(
            accountModel,
            { provider: "postgresql" },
         );

         expect(Account).toBeInstanceOf(SqlTable);
         expect(Account.$accountId).toBeInstanceOf(SqlTableColumn);
         expect(Account.$email).toBeInstanceOf(SqlTableColumn);
         expect(Account.$accountId?.columnName).toBe("account_id");
      });

      test("fromPrismaModelTable/View accept PrismaModel directly", async () => {
         const models = await fixture.loadModels();
         const accountModel = findModel(models, "Account");
         const Table = fromPrismaModelTable<Record<string, unknown>, Record<string, unknown>, Record<string, unknown>>(
            accountModel,
            { provider: "sqlite" },
         );
         const View = fromPrismaModelView<Record<string, unknown>>(accountModel, { provider: "sqlite" });

         expect(Table).toBeInstanceOf(SqlTable);
         expect(View).toBeInstanceOf(SqlTable);
         expect(View.crud.insert).toBe(false);
      });

      test("builds complex Vexnor SQL from Prisma-derived tables", async () => {
         const models = await fixture.loadModels();
         const accountModel = findModel(models, "Account");
         const orderModel = findModel(models, "Order");
         const orderItemModel = findModel(models, "OrderItem");

         const Account = fromPrismaModelTable<Record<string, unknown>, Record<string, unknown>, Record<string, unknown>>(
            accountModel,
            { provider: "postgresql", schema: "vexnor_dev" },
         );
         const Order = fromPrismaModelTable<Record<string, unknown>, Record<string, unknown>, Record<string, unknown>>(
            orderModel,
            { provider: "postgresql", schema: "vexnor_dev" },
         );
         const OrderItem = fromPrismaModelTable<Record<string, unknown>, Record<string, unknown>, Record<string, unknown>>(
            orderItemModel,
            { provider: "postgresql", schema: "vexnor_dev" },
         );

         const query = sql`
         SELECT
          ${row(Account.$$)},
          COUNT(${OrderItem.$productId}) AS ${col<{ orderCount: number }>("orderCount")},
          COALESCE(SUM(${OrderItem.$quantity}), 0) AS ${col<{ totalQuantity: number }>("totalQuantity")}
        FROM ${Account}
         LEFT JOIN ${Order} ON ${Order.$accountId} = ${Account.$accountId}
         LEFT JOIN ${OrderItem} ON ${OrderItem.$orderId} = ${Order.$orderId}
         WHERE ${Account.$status} = ${"created"}
        GROUP BY ${Account.$accountId}, ${Account.$email}, ${Account.$firstName}, ${Account.$lastName}
      `.getSql({});

         expect(query.text).toMatchInlineSnapshot(`
        "/* <query_0> */
        SELECT
          "a_1"."account_id" AS "accountId",
          "a_1"."status",
          "a_1"."email",
          "a_1"."first_name" AS "firstName",
          "a_1"."last_name" AS "lastName",
          "a_1"."notes",
          "a_1"."created_at" AS "createdAt",
          "a_1"."modified_at" AS "modifiedAt",
          "a_1"."parent_id" AS "parentId",
          COUNT("oi_2"."product_id") AS "orderCount",
          COALESCE(SUM("oi_2"."quantity"), 0) AS "totalQuantity"
        FROM
          "vexnor_dev"."account" AS "a_1"
          LEFT JOIN "vexnor_dev"."order" AS "o_3" ON "o_3"."account_id" = "a_1"."account_id"
          LEFT JOIN "vexnor_dev"."order_item" AS "oi_2" ON "oi_2"."order_id" = "o_3"."order_id"
        WHERE
          "a_1"."status" = $1
        GROUP BY
          "a_1"."account_id",
          "a_1"."email",
          "a_1"."first_name",
          "a_1"."last_name"
          /* </query_0> */"
      `);
         expect(query.values).toMatchInlineSnapshot(`
        [
          "created",
        ]
      `);
      });
   });
}
