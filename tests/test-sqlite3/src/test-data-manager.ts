import { Account, IAccountInsert, IAccountSelect } from "./codegen/main.account-table.js";
import { Order, IOrderInsert, IOrderSelect } from "./codegen/main.order-table.js";
import { OrderItem, IOrderItemInsert, IOrderItemSelect } from "./codegen/main.order_item-table.js";
import { Product, IProductInsert, IProductSelect } from "./codegen/main.product-table.js";
import { sql } from "@vexnor/sqlite3";
import assert, { ok } from "node:assert";
import { getTag } from "./tags.js";
import { insert, row } from "@vexnor/core";
import { expect } from "vitest";
import type Database from "better-sqlite3";

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

   async initRootAccounts(db: Database.Database) {
      const accountInserts: IAccountInsert[] = [];
      for (let i = 0; i < this.ACCOUNT_ROOT_COUNT; i++) {
         const id = crypto.randomUUID().slice(0, 4);
         const index = String(i).padStart(3, "0");
         accountInserts.push({
            status: "created",
            firstName: `John-${index}-${id} (root)-${this.TAG}`,
            lastName: `Doe-${index}-${id} (root)-${this.TAG}`,
            email: `john.doe.root-${index}-${id}-${this.TAG}@example.com`,
         });
      }
      const accounts = await sql`
         insert into ${Account}
            ${insert(Account, "rows")}
            returning ${row(Account.$$)}
      `.sqlite.all({ db, params: { rows: accountInserts } });

      ok(accounts?.length, "root accounts not inserted");
      assert.deepEqual(accounts.length, this.ACCOUNT_ROOT_COUNT);
      this.rootAccounts.push(...accounts);
   }

   async initChildAccounts(db: Database.Database) {
      ok(this.rootAccounts.length > 0, "must initialize root accounts first");

      for (let i = 0; i < this.rootAccounts.length; i++) {
         const rootIndex = String(i).padStart(3, "0");
         for (let k = 0; k < this.ACCOUNT_CHILD_FACTOR; k++) {
            const childIndex = String(k).padStart(3, "0");
            const id = crypto.randomUUID().slice(0, 4);
            const parent = this.rootAccounts[i]!;
            ok(parent);

            const accountInsert: IAccountInsert = {
               status: "created",
               firstName: `John-${rootIndex}-${childIndex}-${id} (child ${childIndex})-${this.TAG}`,
               lastName: `Doe-${rootIndex}-${childIndex}-${id} (child ${childIndex})-${this.TAG}`,
               email: `john.doe.child-${rootIndex}-${childIndex}-${id}-${this.TAG}@example.com`,
               parentId: parent.accountId,
            };
            const account = await sql`
               insert into ${Account}
                  ${insert(Account, "rows")}
                  returning ${row(Account.$$)}
            `.sqlite.one({ db, params: { rows: [accountInsert] } });
            expect(account).toEqual(
               expect.objectContaining({
                  status: "created",
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

   async initProducts(db: Database.Database) {
      const inserts: IProductInsert[] = Array.from({ length: this.PRODUCT_COUNT }, (_, i) => ({
         name: `Product-${String(i).padStart(3, "0")}-${this.TAG}`,
         price: Math.round(Math.random() * 10000) / 100,
      }));
      const inserted = await sql`
         insert into ${Product}
            ${insert(Product, "rows")}
            returning ${row(Product.$$)}
      `.sqlite.all({ db, params: { rows: inserts } });
      ok(inserted?.length, "products not inserted");
      this.products.push(...inserted);
   }

   async initOrders(db: Database.Database) {
      ok(this.rootAccounts.length > 0 && this.childAccounts.length > 0, "must initialize accounts first");

      const allAccounts = [...this.rootAccounts, ...this.childAccounts];
      for (const account of allAccounts) {
         const inserts: IOrderInsert[] = Array.from({ length: this.ACCOUNT_ORDER_FACTOR }, () => ({
            accountId: account.accountId,
         }));
         const inserted = await sql`
            insert into ${Order}
               ${insert(Order, "rows")}
               returning ${row(Order.$$)}
         `.sqlite.all({ db, params: { rows: inserts } });
         ok(inserted?.length, "orders not inserted");
         this.orders.push(...inserted);
      }
   }

   async initOrderItems(db: Database.Database) {
      for (const order of this.orders) {
         const inserts: IOrderItemInsert[] = Array.from({ length: this.ORDER_ITEM_FACTOR }, (_, i) => ({
            orderId: order.orderId!,
            productId: this.products[i % this.products.length]!.productId!,
            productPrice: Math.round(Math.random() * 10000) / 100,
            quantity: Math.floor(Math.random() * 10) + 1,
         }));
         const inserted = await sql`
            insert into ${OrderItem}
               ${insert(OrderItem, "rows")}
               returning ${row(OrderItem.$$)}
         `.sqlite.all({ db, params: { rows: inserts } });
         ok(inserted?.length, "order items not inserted");
         this.orderItems.push(...inserted);
      }
   }

   async cleanAll(db: Database.Database) {
      const timestamp = new Date().toJSON();

      await sql`delete from ${OrderItem} where ${OrderItem.$createdAt} < ${timestamp}`.sqlite.run({ db });
      await sql`delete from ${Order} where ${Order.$createdAt} < ${timestamp}`.sqlite.run({ db });
      await sql`delete from ${Product}`.sqlite.run({ db });
      await sql`delete from ${Account} where ${Account.$createdAt} < ${timestamp}`.sqlite.run({ db });

      return { timestamp };
   }
}
