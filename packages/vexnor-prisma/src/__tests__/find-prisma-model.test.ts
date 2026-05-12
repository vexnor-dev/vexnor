import { resolve } from "node:path";
import { describe, expect, test } from "vitest";
import { findPrismaModel } from "../find-prisma-model.js";

describe("findPrismaModel", () => {
   test("v6 + prisma-client-js: returns model from exposed Prisma.dmmf", async () => {
      const generated = await import("./fixtures-v6-client-js/generated/index.js");
      const accountModel = await findPrismaModel("Account", { dmmf: generated.Prisma.dmmf });
      expect(accountModel.name).toBe("Account");
      expect(accountModel.dbName).toBe("account");
   });

   test("v6 + prisma-client: falls back to getDMMF when Prisma.dmmf is unavailable", async () => {
      const schemaPath = resolve(__dirname, "fixtures-v6-client/schema.prisma");
      const accountModel = await findPrismaModel("Account", { schemaPath });
      expect(accountModel.name).toBe("Account");
      expect(accountModel.dbName).toBe("account");
   });

   test("v7 + prisma-client-js: returns model from exposed Prisma.dmmf", async () => {
      const generated = await import("./fixtures-v7-client-js/generated/index.js");
      const accountModel = await findPrismaModel("Account", { dmmf: generated.Prisma.dmmf });
      expect(accountModel.name).toBe("Account");
      expect(accountModel.dbName).toBe("account");
   });

   test("v7 + prisma-client: falls back to getDMMF when Prisma.dmmf is unavailable", async () => {
      const schemaPath = resolve(__dirname, "fixtures-v7-client/schema.prisma");
      const accountModel = await findPrismaModel("Account", { schemaPath });
      expect(accountModel.name).toBe("Account");
      expect(accountModel.dbName).toBe("account");
   });
});
