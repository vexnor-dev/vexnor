import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sql } from "@vexnor/duckdb";
import { db } from "./config.js";

describe.sequential("DuckDB direct file query e2e", () => {
   const directory = join(tmpdir(), `vexnor-duckdb-files-${crypto.randomUUID()}`);
   const csvPath = join(directory, "products.csv");
   const jsonPath = join(directory, "products.json");
   const parquetPath = join(directory, "products.parquet");

   beforeAll(async () => {
      mkdirSync(directory, { recursive: true });
      writeFileSync(csvPath, "product_id,label,price\n1,CSV Product,10.50\n", "utf8");
      writeFileSync(jsonPath, '{"product_id":2,"label":"JSON Product","price":20.75}\n', "utf8");
      await db.run(`copy (select * from read_csv_auto('${csvPath.replaceAll("'", "''")}')) to '${parquetPath.replaceAll("'", "''")}' (format parquet)`);
   });

   afterAll(() => {
      rmSync(directory, { recursive: true, force: true });
   });

   test("queries CSV through parameterized table functions", async () => {
      const result = await sql`select * from read_csv_auto(${csvPath})`.duckdb.all({ db });

      expect(result).toMatchInlineSnapshot(`
        [
          {
            "label": "CSV Product",
            "price": 10.5,
            "product_id": 1n,
          },
        ]
      `);
   });

   test("queries newline-delimited JSON through parameterized table functions", async () => {
      const result = await sql`select * from read_json_auto(${jsonPath})`.duckdb.all({ db });

      expect(result).toMatchInlineSnapshot(`
        [
          {
            "label": "JSON Product",
            "price": 20.75,
            "product_id": 2n,
          },
        ]
      `);
   });

   test("queries Parquet through parameterized table functions", async () => {
      const result = await sql`select * from read_parquet(${parquetPath})`.duckdb.all({ db });

      expect(result).toMatchInlineSnapshot(`
        [
          {
            "label": "CSV Product",
            "price": 10.5,
            "product_id": 1n,
          },
        ]
      `);
   });
});
