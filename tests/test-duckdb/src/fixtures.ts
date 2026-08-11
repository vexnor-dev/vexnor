import { insert, row } from "@vexnor/core";
import { sql } from "@vexnor/duckdb";
import { Account, type IAccountInsert, type IAccountSelect } from "./codegen/main.account-table.js";
import { Order, type IOrderSelect } from "./codegen/main.order-table.js";
import { Product, type IProductSelect } from "./codegen/main.product-table.js";
import { db } from "./config.js";

export async function insertAccount(prefix: string, values: Partial<IAccountInsert> = {}): Promise<IAccountSelect> {
   return sql`
      insert into ${Account} ${insert(Account, "rows")} returning ${row(Account.$$)}
   `.duckdb.one({
      db,
      params: {
         rows: [{ email: `${prefix}-${crypto.randomUUID()}@example.com`, firstName: prefix, lastName: "DuckDB", ...values }],
      },
   });
}

export async function insertOrder(accountId: string): Promise<IOrderSelect> {
   return Order.duckdb.insertRows().one({ db, params: { rows: [{ accountId }] } });
}

export async function insertProduct(prefix: string): Promise<IProductSelect> {
   const product = await Product.duckdb.insertRows().one({
      db,
      params: {
         rows: [{
            label: `${prefix}-${crypto.randomUUID()}`,
            price: "19.95",
            metadata: JSON.stringify({ brand: "Vexnor", dimensions: { width: 1, height: 2 } }),
         }],
      },
   });

   return sql`
      update ${Product}
      set ${Product.$tags} = ['duckdb', 'e2e']
      where ${Product.$productId} = ${product.productId}
      returning ${row(Product.$$)}
   `.duckdb.one({ db });
}
