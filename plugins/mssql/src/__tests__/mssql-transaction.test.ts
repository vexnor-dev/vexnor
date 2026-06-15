import { describe, expect, test, vi } from "vitest";
import mssql from "mssql";
import { savepoint } from "#/mssql-transaction.js";

const mockTxInstances: {
   begin: ReturnType<typeof vi.fn>;
   commit: ReturnType<typeof vi.fn>;
   rollback: ReturnType<typeof vi.fn>;
}[] = [];

vi.mock("mssql", async (importOriginal) => {
   const real = await importOriginal<{ default: typeof mssql }>();
   const MockTransaction = vi.fn(function (this: Record<string, unknown>) {
      const instance = {
         begin: vi.fn(async () => {}),
         commit: vi.fn(async () => {}),
         rollback: vi.fn(async () => {}),
      };
      mockTxInstances.push(instance);
      Object.assign(this, instance);
   });
   return {
      ...real,
      default: {
         ...real.default,
         Transaction: MockTransaction,
      },
   };
});

describe("transaction (mssql)", () => {
   test("commits on success with default isolation level", async () => {
      mockTxInstances.length = 0;
      const { transaction } = await import("#/mssql-transaction.js");
      const result = await transaction({} as mssql.ConnectionPool, async () => 99);
      expect(result).toBe(99);
      const tx = mockTxInstances[0]!;
      expect(tx.begin).toHaveBeenCalledWith(mssql.ISOLATION_LEVEL.READ_COMMITTED);
      expect(tx.commit).toHaveBeenCalledOnce();
      expect(tx.rollback).not.toHaveBeenCalled();
   });

   test("rolls back and rethrows on callback error", async () => {
      mockTxInstances.length = 0;
      const { transaction } = await import("#/mssql-transaction.js");
      await expect(
         transaction({} as mssql.ConnectionPool, async () => { throw new Error("fail"); }),
      ).rejects.toThrow("fail");
      const tx = mockTxInstances[0]!;
      expect(tx.rollback).toHaveBeenCalledOnce();
      expect(tx.commit).not.toHaveBeenCalled();
   });

   test("passes custom isolation level to begin()", async () => {
      mockTxInstances.length = 0;
      const { transaction } = await import("#/mssql-transaction.js");
      await transaction({} as mssql.ConnectionPool, async () => "ok", { isolationLevel: "SERIALIZABLE" });
      expect(mockTxInstances[0]!.begin).toHaveBeenCalledWith(mssql.ISOLATION_LEVEL.SERIALIZABLE);
   });
});

// savepoint() works directly against a plain mock object — no driver needed
function makeSavepointTx() {
   const queries: string[] = [];
   const request = {
      query: async (sql: string) => {
         queries.push(sql);
         return { recordsets: [[]], recordset: [], rowsAffected: [0], output: {} };
      },
   };
   return {
      tx: { request: () => request } as unknown as InstanceType<typeof mssql.Transaction>,
      queries,
      request,
   };
}

describe("savepoint (mssql)", () => {
   test("issues SAVE TRANSACTION and returns result on success (named)", async () => {
      const { tx, queries, request } = makeSavepointTx();
      const result = await savepoint(tx, "sp1", async (req) => {
         expect(req).toBe(request);
         return "saved";
      });
      expect(result).toBe("saved");
      expect(queries).toMatchInlineSnapshot(`
        [
          "SAVE TRANSACTION sp1",
        ]
      `);
   });

   test("issues ROLLBACK TRANSACTION on error (named)", async () => {
      const { tx, queries } = makeSavepointTx();
      const result = await savepoint(tx, "sp1", async () => { throw new Error("fail"); });
      expect(result).toBeUndefined();
      expect(queries).toMatchInlineSnapshot(`
        [
          "SAVE TRANSACTION sp1",
          "ROLLBACK TRANSACTION sp1",
        ]
      `);
   });

   test("auto-generates savepoint name (unnamed)", async () => {
      const { tx, queries } = makeSavepointTx();
      await savepoint(tx, async () => "ok");
      expect(queries[0]).toMatch(/^SAVE TRANSACTION sp_[a-z0-9]+$/);
      expect(queries[1]).toBeUndefined();
   });

   test("rolls back auto-generated savepoint on error", async () => {
      const { tx, queries } = makeSavepointTx();
      await savepoint(tx, async () => { throw new Error("no"); });
      expect(queries[0]).toMatch(/^SAVE TRANSACTION sp_[a-z0-9]+$/);
      expect(queries[1]).toMatch(/^ROLLBACK TRANSACTION sp_[a-z0-9]+$/);
   });
});
