import { describe, expect, test } from "vitest";
import { SqlTable, SqlTableColumn, col, row, sql } from "vexnor";
import { readFile } from "node:fs/promises";
import { fromPrismaModelTable, fromPrismaModelView } from "../from-prisma-model.js";
import { getDialectFromPrismaProvider } from "../dialect.js";
import { PrismaModel } from "../prisma-dmmf-types.js";

type Fixture = {
   tag: "v6-client-js" | "v6-client" | "v7-client-js" | "v7-client";
   loadModels: () => Promise<readonly PrismaModel[]>;
};

async function loadModelsFromClientJsIndex(modulePath: string): Promise<readonly PrismaModel[]> {
   const generated = await import(modulePath);
   const models = generated?.Prisma?.dmmf?.datamodel?.models as readonly PrismaModel[] | undefined;
   if (!models) throw new Error(`Prisma dmmf models not found in generated client: ${modulePath}`);
   return models;
}

type V7RuntimeDataModel = {
   models: Record<string, { dbName?: string | null; schema?: string | null; fields: PrismaModel["fields"] }>;
};

function getInlineSchemaFromSource(source: string): string {
   const match =
      source.match(/"inlineSchema":\s*"([\s\S]*?)",\r?\n\s*"runtimeDataModel"/) ??
      source.match(/"inlineSchema":\s*"([\s\S]*?)",\r?\n\s*"/) ??
      source.match(/"inlineSchema":\s*"([\s\S]*?)"\r?\n\s*}/);
   return match?.[1] ? (JSON.parse(`"${match[1]}"`) as string) : "";
}

function parseModelsFromPrismaClientClassSource(source: string): readonly PrismaModel[] {
   const inlineSchema = getInlineSchemaFromSource(source);
   const modelSchemaByName = new Map<string, string>();
   for (const match of inlineSchema.matchAll(/model\s+(\w+)\s*\{[\s\S]*?@@schema\("([^"]+)"\)/g)) {
      const modelName = match[1];
      const modelSchema = match[2];
      if (modelName && modelSchema) modelSchemaByName.set(modelName, modelSchema);
   }
   const defaultSchemaMatch = inlineSchema.match(/schemas\s*=\s*\["([^"]+)"\]/);
   const defaultSchema = defaultSchemaMatch?.[1] ?? null;

   const match = source.match(/config\.runtimeDataModel\s*=\s*JSON\.parse\("(.+?)"\)/s);
   if (!match?.[1]) throw new Error("Prisma v7 runtimeDataModel JSON not found.");
   const runtimeDataModel = JSON.parse(JSON.parse(`"${match[1]}"`)) as V7RuntimeDataModel;

   return Object.entries(runtimeDataModel.models).map(([name, model]) => ({
      name,
      dbName: model.dbName ?? null,
      schema: model.schema ?? modelSchemaByName.get(name) ?? defaultSchema,
      fields: model.fields,
   }));
}

function mergeSchemaFromSourceIfMissing(models: readonly PrismaModel[], source: string): readonly PrismaModel[] {
   const inlineSchema = getInlineSchemaFromSource(source);
   if (!inlineSchema) return models;

   const modelSchemaByName = new Map<string, string>();
   for (const match of inlineSchema.matchAll(/model\s+(\w+)\s*\{[\s\S]*?@@schema\("([^"]+)"\)/g)) {
      const modelName = match[1];
      const modelSchema = match[2];
      if (modelName && modelSchema) modelSchemaByName.set(modelName, modelSchema);
   }
   const defaultSchemaMatch = inlineSchema.match(/schemas\s*=\s*\["([^"]+)"\]/);
   const defaultSchema = defaultSchemaMatch?.[1] ?? null;

   return models.map((model) => ({
      ...model,
      schema: model.schema ?? modelSchemaByName.get(model.name) ?? defaultSchema,
   }));
}

type PrismaClientGeneratedLoadOptions = {
   clientModulePath: string;
   classSourcePath: string;
};

async function loadModelsFromPrismaClientGenerated({
   clientModulePath,
   classSourcePath,
}: PrismaClientGeneratedLoadOptions): Promise<readonly PrismaModel[]> {
   try {
      const generated = await import(clientModulePath);
      const models = (generated as { Prisma?: { dmmf?: { datamodel?: { models?: readonly PrismaModel[] } } } })
         ?.Prisma?.dmmf?.datamodel?.models;
      if (models?.length) return models;
   } catch {
      // Some test runtimes cannot execute generated Prisma client modules.
   }

   const source = await readFile(new URL(classSourcePath, import.meta.url), "utf8");
   return parseModelsFromPrismaClientClassSource(source);
}

type ClientJsIndexWithFallbackSchemaOptions = {
   modulePath: string;
   sourcePath: string;
};

async function loadModelsFromClientJsIndexWithFallbackSchema({
   modulePath,
   sourcePath,
}: ClientJsIndexWithFallbackSchemaOptions): Promise<readonly PrismaModel[]> {
   const models = await loadModelsFromClientJsIndex(modulePath);
   const source = await readFile(new URL(sourcePath, import.meta.url), "utf8");
   return mergeSchemaFromSourceIfMissing(models, source);
}

function findModel(models: readonly PrismaModel[], modelName: string): PrismaModel {
   const model = models.find((m) => m.name === modelName);
   if (!model) throw new Error(`Model not found: ${modelName}`);
   return model;
}

const FIXTURES: Fixture[] = [
   {
      tag: "v6-client-js",
      loadModels: () => loadModelsFromClientJsIndex("./fixtures-v6-client-js/generated/index.js"),
   },
   {
      tag: "v6-client",
      loadModels: () => loadModelsFromPrismaClientGenerated({
         clientModulePath: "./fixtures-v6-client/generated/client.js",
         classSourcePath: "./fixtures-v6-client/generated/internal/class.ts",
      }),
   },
   {
      tag: "v7-client-js",
      loadModels: () =>
         loadModelsFromClientJsIndexWithFallbackSchema({
            modulePath: "./fixtures-v7-client-js/generated/index.js",
            sourcePath: "./fixtures-v7-client-js/generated/index.js",
         }),
   },
   {
      tag: "v7-client",
      loadModels: () =>
         loadModelsFromPrismaClientGenerated({
            clientModulePath: "./fixtures-v7-client/generated/client.js",
            classSourcePath: "./fixtures-v7-client/generated/internal/class.ts",
         }),
   },
];

describe("@vexnor/prisma client", () => {
   test("provider to dialect mapping", () => {
      expect(getDialectFromPrismaProvider("postgresql")).toBe("postgresql");
      expect(getDialectFromPrismaProvider("sqlserver")).toBe("tsql");
      expect(getDialectFromPrismaProvider("sqlite")).toBe("sqlite");
   });
});

for (const fixture of FIXTURES) {
   describe(`@vexnor/prisma client (${fixture.tag})`, () => {
      test("fromPrismaModelTable returns SqlTable with expected columns", async () => {
         const models = await fixture.loadModels();
         const accountModel = findModel(models, "Account");
         const Account = fromPrismaModelTable<Record<string, unknown>, Record<string, unknown>, Record<string, unknown>>(
            accountModel,
            { provider: "postgresql" },
         );

         expect(Account).toBeInstanceOf(SqlTable);
         expect(Account.tableInfo).toEqual({ name: "account", schema: "vexnor_dev" });
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
            { provider: "postgresql" },
         );
         const OrderItem = fromPrismaModelTable<Record<string, unknown>, Record<string, unknown>, Record<string, unknown>>(
            orderItemModel,
            { provider: "postgresql" },
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

         expect(query.text).toContain("SELECT");
         expect(query.text).toContain("\"account_id\" AS \"accountId\"");
         expect(query.text).toContain("COUNT(\"oi_2\".\"product_id\") AS \"orderCount\"");
         expect(query.text).toContain("COALESCE(SUM(\"oi_2\".\"quantity\"), 0) AS \"totalQuantity\"");
         expect(query.text).toContain("LEFT JOIN");
         expect(query.text).toContain("WHERE");
         expect(query.text).toContain("GROUP BY");
         expect(query.values).toMatchInlineSnapshot(`
        [
          "created",
        ]
      `);
      });
   });
}
