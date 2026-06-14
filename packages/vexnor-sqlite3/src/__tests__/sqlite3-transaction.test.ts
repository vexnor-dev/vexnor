// noinspection SqlNoDataSourceInspection,SqlResolve
import { describe, expect, test, beforeAll, afterAll } from "vitest";
import { transaction, savepoint } from "#/sqlite3-transaction.js";
import BetterSqlite3 from "better-sqlite3";

let db: BetterSqlite3.Database;

beforeAll(() => {
   db = new BetterSqlite3(":memory:");
   db.exec("CREATE TABLE t (id INTEGER PRIMARY KEY, val TEXT)");
});

afterAll(() => {
   db.close();
});

describe("transaction (sqlite3)", () => {
   test("commits on success with default DEFERRED behavior", async () => {
      const result = await transaction(db, async (d) => {
         expect(d).toBe(db);
         d.prepare("INSERT INTO t VALUES (1, 'a')").run();
         return "done";
      });
      expect(result).toBe("done");
      const row = db.prepare("SELECT val FROM t WHERE id = 1").get() as { val: string };
      expect(row.val).toBe("a");
   });

   test("rolls back and rethrows on callback error", async () => {
      await expect(
         transaction(db, async (d) => {
            d.prepare("INSERT INTO t VALUES (2, 'b')").run();
            throw new Error("abort");
         }),
      ).rejects.toThrow("abort");
      const row = db.prepare("SELECT val FROM t WHERE id = 2").get();
      expect(row).toBeUndefined();
   });

   test("uses IMMEDIATE behavior when specified", async () => {
      await transaction(
         db,
         async (d) => {
            d.prepare("INSERT INTO t VALUES (3, 'c')").run();
         },
         { behavior: "IMMEDIATE" },
      );
      const row = db.prepare("SELECT val FROM t WHERE id = 3").get() as { val: string };
      expect(row.val).toBe("c");
   });

   test("uses EXCLUSIVE behavior when specified", async () => {
      await transaction(
         db,
         async (d) => {
            d.prepare("INSERT INTO t VALUES (4, 'd')").run();
         },
         { behavior: "EXCLUSIVE" },
      );
      const row = db.prepare("SELECT val FROM t WHERE id = 4").get() as { val: string };
      expect(row.val).toBe("d");
   });
});

describe("savepoint (sqlite3)", () => {
   test("releases named savepoint on success", async () => {
      await transaction(db, async (d) => {
         const result = await savepoint(d, "sp_test", async (d2) => {
            d2.prepare("INSERT INTO t VALUES (10, 'sp')").run();
            return "saved";
         });
         expect(result).toBe("saved");
      });
      const row = db.prepare("SELECT val FROM t WHERE id = 10").get() as { val: string };
      expect(row.val).toBe("sp");
   });

   test("rolls back to named savepoint on error", async () => {
      await transaction(db, async (d) => {
         const result = await savepoint(d, "sp_fail", async (d2) => {
            d2.prepare("INSERT INTO t VALUES (11, 'fail')").run();
            throw new Error("oops");
         });
         expect(result).toBeUndefined();
      });
      const row = db.prepare("SELECT val FROM t WHERE id = 11").get();
      expect(row).toBeUndefined();
   });

   test("auto-generates savepoint name", async () => {
      await transaction(db, async (d) => {
         const result = await savepoint(d, async (d2) => {
            d2.prepare("INSERT INTO t VALUES (12, 'auto')").run();
            return "auto-ok";
         });
         expect(result).toBe("auto-ok");
      });
      const row = db.prepare("SELECT val FROM t WHERE id = 12").get() as { val: string };
      expect(row.val).toBe("auto");
   });

   test("rolls back auto-named savepoint on error", async () => {
      await transaction(db, async (d) => {
         const result = await savepoint(d, async (d2) => {
            d2.prepare("INSERT INTO t VALUES (13, 'nope')").run();
            throw new Error("no");
         });
         expect(result).toBeUndefined();
      });
      const row = db.prepare("SELECT val FROM t WHERE id = 13").get();
      expect(row).toBeUndefined();
   });
});
