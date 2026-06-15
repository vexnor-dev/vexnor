import { Account, IAccountInsert, IAccountSelect } from "./codegen/vexnor_dev.account-table.js";
import { Order, IOrderInsert, IOrderSelect } from "./codegen/vexnor_dev.order-table.js";
import { OrderItem, IOrderItemInsert, IOrderItemSelect } from "./codegen/vexnor_dev.order_item-table.js";
import { Product, IProductInsert, IProductSelect } from "./codegen/vexnor_dev.product-table.js";
import { sql } from "@vexnor/mssql";
import assert, { ok } from "node:assert";
import { getTag } from "./tags.js";
import { row, SqlQueryAny } from "@vexnor/core";
import { expect } from "vitest";
import { ConnectionPool } from "mssql";
import "@vexnor/mssql";

export class TestDataManager {
   readonly rootAccounts: IAccountSelect[] = [];
   readonly childAccounts: IAccountSelect[] = [];
   readonly orders: IOrderSelect[] = [];
   readonly orderItems: IOrderItemSelect[] = [];
   readonly products: IProductSelect[] = [];

   readonly PRODUCT_COUNT: number = 20;
   readonly ACCOUNT_ROOT_COUNT: number = 100;
   readonly ACCOUNT_CHILD_FACTOR: number = 3;
   readonly ACCOUNT_ORDER_FACTOR: number = 2;
   readonly ORDER_ITEM_FACTOR: number = 2;
   readonly TAG: string;

   constructor(
      ctx: { name: string },
      config?: Partial<
         Pick<
            TestDataManager,
            "ACCOUNT_ROOT_COUNT" | "ACCOUNT_CHILD_FACTOR" | "ACCOUNT_ORDER_FACTOR" | "ORDER_ITEM_FACTOR"
         >
      >,
   ) {
      this.TAG = getTag(ctx);
      if (config) {
         Object.assign(this, config);
      }
   }

   async initRootAccounts(pool: ConnectionPool) {
      const accountInserts: IAccountInsert[] = [];
      for (let i = 0; i < this.ACCOUNT_ROOT_COUNT; i++) {
         const id = crypto.randomUUID().slice(0, 4);
         const index = String(i).padStart(3, "0");
         accountInserts.push({
            status: "CREATED",
            firstName: `John-${index}-${id} (root)-${this.TAG}`,
            lastName: `Doe-${index}-${id} (root)-${this.TAG}`,
            email: `john.doe.root-${index}-${id}-${this.TAG}@example.com`,
         });
      }
      const accounts = await sql`
            insert into ${Account}
               ${Account.insertCols(...accountInserts)}
               output ${row(Account.as(`inserted`).$$)}
               ${Account.insertVals(...accountInserts)}
         `.mssql.all({
         db: pool.request(),
         options: {
            debug: (data) => {
               console.log(data.text);
            },
         },
      });

      ok(accounts?.length, "root accounts not inserted");
      assert.deepEqual(accounts.length, this.ACCOUNT_ROOT_COUNT);
      // expect(accounts.length).toBe(ROOT_COUNT);
      this.rootAccounts.push(...accounts);
   }

   async initChildAccounts(pool: ConnectionPool) {
      ok(this.rootAccounts.length > 0, "must initialize root accounts first");

      for (let i = 0; i < this.rootAccounts.length; i++) {
         const rootIndex = String(i).padStart(3, "0");
         for (let k = 0; k < this.ACCOUNT_CHILD_FACTOR; k++) {
            const childIndex = String(k).padStart(3, "0");
            const id = crypto.randomUUID().slice(0, 4);
            const parent = this.rootAccounts[i]!;
            ok(parent);

            const accountInsert: IAccountInsert = {
               status: "CREATED",
               firstName: `John-${rootIndex}-${childIndex}-${id} (child ${childIndex})-${this.TAG}`,
               lastName: `Doe-${rootIndex}-${childIndex}-${id} (child ${childIndex})-${this.TAG}`,
               email: `john.doe.child-${rootIndex}-${childIndex}-${id}-${this.TAG}@example.com`,
               parentId: parent.accountId,
            };
            const account = await sql`
               insert into ${Account}
                  ${Account.insertCols(accountInsert)}
                  output ${row(Account.as(`inserted`).$$)}
                  ${Account.insertVals(accountInsert)}
            `.mssql.one({ db: pool.request() });
            expect(account).toEqual(
               expect.objectContaining({
                  status: "CREATED",
                  firstName: `John-${rootIndex}-${childIndex}-${id} (child ${childIndex})-${this.TAG}`,
                  lastName: `Doe-${rootIndex}-${childIndex}-${id} (child ${childIndex})-${this.TAG}`,
                  email: `john.doe.child-${rootIndex}-${childIndex}-${id}-${this.TAG}@example.com`,
                  parentId: parent.accountId,
               }),
            );
            this.childAccounts.push(account);
         }
      }
   }

   async initProducts(pool: ConnectionPool) {
      const inserts: IProductInsert[] = Array.from({ length: this.PRODUCT_COUNT }, (_, i) => ({
         label: `Product-${String(i).padStart(3, "0")}-${this.TAG}`,
         price: Math.round(Math.random() * 10000) / 100,
      }));
      const inserted = await sql`
         insert into ${Product}
            ${Product.insertCols(...inserts)}
            output ${row(Product.as(`inserted`).$$)}
            ${Product.insertVals(...inserts)}
      `.mssql.all({ db: pool.request() });
      ok(inserted?.length, "products not inserted");
      this.products.push(...inserted);
   }

   async initOrders(pool: ConnectionPool) {
      ok(this.rootAccounts.length > 0 && this.childAccounts.length > 0, "must initialize accounts first");

      const allAccounts = [...this.rootAccounts, ...this.childAccounts];
      for (const account of allAccounts) {
         const inserts: IOrderInsert[] = Array.from({ length: this.ACCOUNT_ORDER_FACTOR }, () => ({
            accountId: account.accountId,
         }));
         const inserted = await sql`
            insert into ${Order}
               ${Order.insertCols(...inserts)}
               output ${row(Order.as(`inserted`).$$)}
               ${Order.insertVals(...inserts)}
         `.mssql.all({ db: pool.request() });
         ok(inserted?.length, "orders not inserted");
         this.orders.push(...inserted);
      }
   }

   async initOrderItems(pool: ConnectionPool) {
      for (const order of this.orders) {
         const inserts: IOrderItemInsert[] = Array.from({ length: this.ORDER_ITEM_FACTOR }, (_, i) => ({
            orderId: order.orderId,
            productId: this.products[i % this.products.length]!.productId,
            productPrice: Math.round(Math.random() * 10000) / 100,
            quantity: Math.floor(Math.random() * 10) + 1,
         }));
         const inserted = await sql`
            insert into ${OrderItem}
               ${OrderItem.insertCols(...inserts)}
               output ${row(OrderItem.as(`inserted`).$$)}
               ${OrderItem.insertVals(...inserts)}
         `.mssql.all({ db: pool.request() });
         ok(inserted?.length, "order items not inserted");
         this.orderItems.push(...inserted);
      }
   }

   async cleanAll(pool: ConnectionPool) {
      const queries: { type: string; query: SqlQueryAny }[] = [
         {
            type: OrderItem.tableInfo.name,
            query: sql`delete from ${OrderItem}`,
         },
         {
            type: Product.tableInfo.name,
            query: sql`delete from ${Product}`,
         },
         { type: Order.tableInfo.name, query: sql`delete from ${Order}` },
         {
            type: `${Account.tableInfo.name} -children-`,
            query: sql`delete from ${Account} where ${Account.$parentId} is not null`,
         },
         {
            type: `${Account.tableInfo.name} -parents-`,
            query: sql`delete from ${Account}`,
         },
      ];
      const results = [];
      for (const { type, query } of queries) {
         const result = await query.mssql.run({ db: pool.request() });
         results.push({ type, rowsAffected: result.rowsAffected[0] });
      }

      return results;
   }
}
