import { describe, expect, test, vi } from "vitest";

const { createConnection } = vi.hoisted(() => ({
   createConnection: vi.fn(async () => ({ db: { run: vi.fn() } })),
}));

vi.mock("@vexnor/duckdb", () => ({
   VexnorDuckDB: class {
      createConnection = createConnection;
   },
}));

describe("Next.js DuckDB connection", () => {
   test("opens the file lazily and reuses the connection", async () => {
      const { getDuckDb } = await import("../duckdb");

      expect(createConnection.mock.calls.length).toMatchInlineSnapshot(`0`);
      const first = await getDuckDb();
      const second = await getDuckDb();
      expect({ calls: createConnection.mock.calls.length, sameConnection: first === second }).toMatchInlineSnapshot(`
        {
          "calls": 1,
          "sameConnection": true,
        }
      `);
   });
});
