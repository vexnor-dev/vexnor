import { beforeAll, describe, expect, test } from "vitest";
import { ok } from "node:assert";
import { col, row, val } from "valnor";
import { jsonMany, sql } from "valnor-mssql";
import { Account } from "./codegen/valnor_test.account-table.js";
import { Order } from "./codegen/valnor_test.order-table.js";
import { OrderItem } from "./codegen/valnor_test.order_item-table.js";
import { pool } from "./mssql-pool.js";
import { TestDataManager } from "./test-data-manager.js";

describe.sequential("advanced SQL - mssql", async (ctx) => {
   const dataManager = new TestDataManager(ctx, {
      ACCOUNT_ROOT_COUNT: 10,
      ACCOUNT_CHILD_FACTOR: 3,
      ACCOUNT_ORDER_FACTOR: 2,
      ORDER_ITEM_FACTOR: 2,
   });

   beforeAll(async () => {
      await dataManager.initRootAccounts(pool);
      await dataManager.initChildAccounts(pool);
      await dataManager.initProducts(pool);
      await dataManager.initOrders(pool);
      await dataManager.initOrderItems(pool);
   });

   // -------------------------------------------------------------------------
   // 1. Recursive CTE — walk the full account hierarchy to arbitrary depth
   // -------------------------------------------------------------------------
   test("recursive CTE: walk full account hierarchy from root", async () => {
      const root = dataManager.rootAccounts[0]!;
      ok(root);

      const anchor = sql`
        select ${row(Account.$$)}, ${val`0`.as<{ depth: number }>("depth")}
        from ${Account}
        where ${Account.$accountId} = ${root.accountId}
      `;

      const hierarchy = sql`
         ${anchor} union all
         select ${row(Account.as("b").$$)}, ${anchor.out.$depth} + 1 as ${col<{ depth: number }>("depth")}
         from ${Account.as("b")}
                 join ${anchor.out} on ${anchor.out.$accountId} = ${Account.as("b").$parentId}
      `;

      const query = sql`
         with ${hierarchy}
         select ${row(hierarchy.$$)} from ${hierarchy}
         order by ${hierarchy.$depth}, ${hierarchy.$email}
      `;

      const result = await query.mssql.getAll({ db: pool.request() });

      expect(result).toHaveLength(1 + dataManager.ACCOUNT_CHILD_FACTOR);
      expect(result[0]).toMatchObject({ accountId: root.accountId, parentId: null, depth: 0 });
      const expectedChildren = dataManager.childAccounts
         .filter((c) => c.parentId === root.accountId)
         .sort((a, b) => a.email.localeCompare(b.email));
      for (let i = 0; i < expectedChildren.length; i++) {
         expect(result[i + 1]).toMatchObject({
            accountId: expectedChildren[i]!.accountId,
            email: expectedChildren[i]!.email,
            parentId: root.accountId,
            depth: 1,
         });
      }
   });

   test("recursive CTE: collect all descendant ids via STRING_AGG", async () => {
      const root = dataManager.rootAccounts[0]!;
      ok(root);

      const anchor = sql`
         select ${row(Account.$accountId, Account.$parentId)}
         from ${Account}
         where ${Account.$parentId} = ${root.accountId}
      `;

      const descendants = sql`
         ${anchor} union all
         select ${row(Account.as("b").$accountId, Account.as("b").$parentId)}
         from ${Account.as("b")}
         join ${anchor.out} on ${anchor.out.$accountId} = ${Account.as("b").$parentId}
      `;

      const result = await sql`
         with ${descendants}
         select string_agg(cast(${descendants.$accountId} as nvarchar(100)), ',') as ${col<{ ids: string }>("ids")}
         from ${descendants}
      `.mssql.getOneRequired({ db: pool.request() });

      const expectedChildIds = dataManager.childAccounts
         .filter((c) => c.parentId === root.accountId)
         .map((c) => c.accountId)
         .sort();
      const resultIds = result.ids.split(",").sort();
      expect(resultIds).toEqual(expect.arrayContaining(expectedChildIds));
      expect(resultIds).toHaveLength(expectedChildIds.length);
   });

   // -------------------------------------------------------------------------
   // 2. Multi-table join with aggregates (GROUP BY + HAVING)
   // -------------------------------------------------------------------------
   test("multi-table join + GROUP BY + HAVING: accounts with total spend > 0", async () => {
      const accountIds = dataManager.rootAccounts.map((a) => a.accountId);
      const expectedAccounts = dataManager.rootAccounts.slice().sort((a, b) => a.email.localeCompare(b.email));

      const result = await sql`
         select
            ${row(
               Account.$accountId,
               Account.$email,
               val`count(distinct ${Order.$orderId})`.as<{ orderCount: number }>("orderCount"),
               val`sum(${OrderItem.$quantity} * ${OrderItem.$productPrice})`.as<{ totalSpend: number }>("totalSpend"),
               val`count(distinct ${OrderItem.$productId})`.as<{ distinctProducts: number }>("distinctProducts"),
            )}
         from ${Account}
         join ${Order} on ${Order.$accountId} = ${Account.$accountId}
         join ${OrderItem} on ${OrderItem.$orderId} = ${Order.$orderId}
         where ${Account.$accountId} in (${accountIds})
         group by ${Account.$accountId}, ${Account.$email}
         having count(distinct ${Order.$orderId}) > 0
         order by ${Account.$email}
      `.mssql.getAll({ db: pool.request() });

      const spendByAccount = new Map<string, number>();
      for (const account of dataManager.rootAccounts) {
         const orderIds = dataManager.orders.filter((o) => o.accountId === account.accountId).map((o) => o.orderId);
         const spend = dataManager.orderItems
            .filter((i) => orderIds.includes(i.orderId))
            .reduce((sum, i) => sum + Number(i.quantity) * Number(i.productPrice), 0);
         spendByAccount.set(account.accountId, spend);
      }

      expect(result).toHaveLength(dataManager.ACCOUNT_ROOT_COUNT);
      for (let i = 0; i < result.length; i++) {
         const expected = expectedAccounts[i]!;
         expect(result[i]).toMatchObject({
            accountId: expected.accountId,
            email: expected.email,
         });
         expect(Number(result[i]!.orderCount)).toBe(dataManager.ACCOUNT_ORDER_FACTOR);
         expect(Number(result[i]!.totalSpend)).toBeCloseTo(spendByAccount.get(expected.accountId)!, 2);
         expect(Number(result[i]!.distinctProducts)).toBe(dataManager.ORDER_ITEM_FACTOR);
      }
   });

   test("multi-table join + HAVING: filter accounts with more than 1 distinct product", async () => {
      const accountIds = dataManager.rootAccounts.map((a) => a.accountId);

      const result = await sql`
         select
            ${row(
               Account.$accountId,
               val`count(distinct ${OrderItem.$productId})`.as<{ distinctProducts: number }>("distinctProducts"),
            )}
         from ${Account}
         join ${Order} on ${Order.$accountId} = ${Account.$accountId}
         join ${OrderItem} on ${OrderItem.$orderId} = ${Order.$orderId}
         where ${Account.$accountId} in (${accountIds})
         group by ${Account.$accountId}
         having count(distinct ${OrderItem.$productId}) > 1
      `.mssql.getAll({ db: pool.request() });

      expect(result).toHaveLength(dataManager.ACCOUNT_ROOT_COUNT);
      for (const row_ of result) {
         expect(row_).toMatchObject({ accountId: expect.any(String) });
         expect(accountIds).toContain(row_.accountId);
         expect(Number(row_.distinctProducts)).toBe(dataManager.ORDER_ITEM_FACTOR);
      }
   });

   // -------------------------------------------------------------------------
   // 3. Nested jsonMany — accounts → orders (with items) in one shot
   // -------------------------------------------------------------------------
   test("nested jsonMany: accounts with orders, each order with its items", async () => {
      const root = dataManager.rootAccounts[0]!;
      ok(root);

      const OrderItems = sql`
         select ${row(OrderItem.$orderId, OrderItem.$productId, OrderItem.$quantity, OrderItem.$productPrice)}
         from ${OrderItem}
         where ${OrderItem.$orderId} = ${Order.out.$orderId}
         order by ${OrderItem.$productId}
         offset 0 rows fetch next 1000 rows only
      `;

      const AccountOrders = sql`
         select
            ${row(Order.$orderId, Order.$status, Order.$createdAt)},
            ${jsonMany(OrderItems).as("items")}
         from ${Order} ${jsonMany(OrderItems)}
         where ${Order.$accountId} = ${Account.out.$accountId}
         order by ${Order.$createdAt}
         offset 0 rows fetch next 1000 rows only
      `;

      const result = await sql`
         select ${row(Account.$accountId, Account.$email)},
                ${jsonMany(AccountOrders).as("orders")}
         from ${Account} ${jsonMany(AccountOrders)}
         where ${Account.$accountId} = ${root.accountId}
      `.mssql.getOneRequired({ db: pool.request() });

      expect(result).toMatchObject({ accountId: root.accountId, email: root.email });
      const orders = JSON.parse(result.orders as unknown as string) as Array<{
         orderId: string;
         status: string;
         createdAt: Date;
         items: string;
      }>;
      expect(orders).toHaveLength(dataManager.ACCOUNT_ORDER_FACTOR);
      const expectedOrderIds = dataManager.orders.filter((o) => o.accountId === root.accountId).map((o) => o.orderId);
      for (const order of orders) {
         expect(expectedOrderIds).toContain(order.orderId);
         expect(order).toMatchObject({ orderId: expect.any(String), status: expect.any(String) });
         const items = JSON.parse(order.items as unknown as string) as Array<{
            orderId: string;
            productId: string;
            quantity: number;
            productPrice: number;
         }>;
         expect(items).toHaveLength(dataManager.ORDER_ITEM_FACTOR);
         for (const item of items) {
            expect(item).toMatchObject({
               orderId: order.orderId,
               productId: expect.any(String),
               quantity: expect.any(Number),
               productPrice: expect.any(Number),
            });
            expect(Number(item.quantity)).toBeGreaterThan(0);
         }
      }
   });

   test("nested jsonMany: multiple accounts each with nested orders+items", async () => {
      const accountIds = dataManager.rootAccounts.slice(0, 3).map((a) => a.accountId);

      const OrderItems = sql`
         select ${row(OrderItem.$orderId, OrderItem.$productId, OrderItem.$quantity)}
         from ${OrderItem}
         where ${OrderItem.$orderId} = ${Order.out.$orderId}
         order by ${OrderItem.$productId}
         offset 0 rows fetch next 1000 rows only
      `;

      const AccountOrders = sql`
         select ${row(Order.$orderId, Order.$accountId)},
                ${jsonMany(OrderItems).as("items")}
         from ${Order} ${jsonMany(OrderItems)}
         where ${Order.$accountId} = ${Account.out.$accountId}
         order by ${Order.$orderId}
         offset 0 rows fetch next 1000 rows only
      `;

      const results = await sql`
         select ${row(Account.$accountId)}, ${jsonMany(AccountOrders).as("orders")}
         from ${Account} ${jsonMany(AccountOrders)}
         where ${Account.$accountId} in (${accountIds})
         order by ${Account.$email}
      `.mssql.getAll({ db: pool.request() });

      expect(results).toHaveLength(3);
      for (const account of results) {
         expect(accountIds).toContain(account.accountId);
         const orders = JSON.parse(account.orders as unknown as string) as Array<{
            orderId: string;
            accountId: string;
            items: string;
         }>;
         expect(orders).toHaveLength(dataManager.ACCOUNT_ORDER_FACTOR);
         for (const order of orders) {
            expect(order).toMatchObject({ orderId: expect.any(String), accountId: account.accountId });
            const items = JSON.parse(order.items as unknown as string) as Array<{
               orderId: string;
               productId: string;
               quantity: number;
            }>;
            expect(items).toHaveLength(dataManager.ORDER_ITEM_FACTOR);
            for (const item of items) {
               expect(item).toMatchObject({
                  orderId: order.orderId,
                  productId: expect.any(String),
                  quantity: expect.any(Number),
               });
            }
         }
      }
   });

   // -------------------------------------------------------------------------
   // 4. Subquery in WHERE
   // -------------------------------------------------------------------------
   test("subquery in WHERE: accounts that have at least one order", async () => {
      const accountIds = dataManager.rootAccounts.map((a) => a.accountId);

      const result = await sql`
         select ${row(Account.$$)}
         from ${Account}
         where ${Account.$accountId} in (${accountIds})
           and ${Account.$accountId} in (
              select ${Order.$accountId} from ${Order}
           )
         order by ${Account.$email}
      `.mssql.getAll({ db: pool.request() });

      expect(result).toHaveLength(dataManager.ACCOUNT_ROOT_COUNT);
      const expectedRootAccounts = dataManager.rootAccounts.slice().sort((a, b) => a.email.localeCompare(b.email));
      for (let i = 0; i < result.length; i++) {
         expect(result[i]).toMatchObject({
            accountId: expectedRootAccounts[i]!.accountId,
            email: expectedRootAccounts[i]!.email,
         });
      }
   });

   test("subquery in WHERE: accounts with no orders (NOT IN)", async () => {
      const orphan = await sql`
         insert into ${Account}
            ${Account.insertCols({
               email: `orphan-${dataManager.TAG}@example.com`,
               firstName: "Orphan",
               lastName: dataManager.TAG,
            })}
            output ${row(Account.as("inserted").$$)}
            ${Account.insertVals({
               email: `orphan-${dataManager.TAG}@example.com`,
               firstName: "Orphan",
               lastName: dataManager.TAG,
            })}
      `.mssql.getOneRequired({ db: pool.request() });

      const result = await sql`
         select ${row(Account.$$)}
         from ${Account}
         where ${Account.$lastName} = ${dataManager.TAG}
           and ${Account.$accountId} not in (
              select ${Order.$accountId} from ${Order}
           )
      `.mssql.getAll({ db: pool.request() });

      expect(result.some((a) => a.accountId === orphan.accountId)).toBe(true);
      const orphanRow = result.find((a) => a.accountId === orphan.accountId);
      expect(orphanRow).toMatchObject({
         accountId: orphan.accountId,
         email: orphan.email,
         firstName: orphan.firstName,
         lastName: orphan.lastName,
      });
   });

   test("subquery in WHERE: EXISTS — accounts that have a paid order", async () => {
      const order = dataManager.orders[0]!;
      ok(order);
      await sql`
         update ${Order}
         set ${Order.$status} = 'paid'
         where ${Order.$orderId} = ${order.orderId}
      `.mssql.run({ db: pool.request() });

      const result = await sql`
         select ${row(Account.$$)}
         from ${Account}
         where exists (
            select 1 from ${Order}
            where ${Order.$accountId} = ${Account.$accountId}
              and ${Order.$status} = 'paid'
         )
         order by ${Account.$email}
      `.mssql.getAll({ db: pool.request() });

      const paidAccount = dataManager.rootAccounts.find((a) => a.accountId === order.accountId)!;
      ok(paidAccount);
      const paidRow = result.find((a) => a.accountId === order.accountId);
      expect(paidRow).toMatchObject({
         accountId: paidAccount.accountId,
         email: paidAccount.email,
         firstName: paidAccount.firstName,
         lastName: paidAccount.lastName,
      });
   });

   test("CTE + subquery in WHERE: accounts whose children have orders", async () => {
      const rootIds = dataManager.rootAccounts.map((a) => a.accountId);

      const result = await sql`
         with child_accounts as (
            select ${Account.$accountId.as("account_id")}, ${Account.$parentId.as("parent_id")}
            from ${Account}
            where ${Account.$parentId} in (${rootIds})
         )
         select ${row(Account.$$)}
         from ${Account}
         where ${Account.$accountId} in (${rootIds})
           and ${Account.$accountId} in (
              select ca.parent_id from child_accounts ca
              where ca.account_id in (select ${Order.$accountId} from ${Order})
           )
         order by ${Account.$email}
      `.mssql.getAll({ db: pool.request() });

      expect(result).toHaveLength(dataManager.ACCOUNT_ROOT_COUNT);
      const expectedRoots = dataManager.rootAccounts.slice().sort((a, b) => a.email.localeCompare(b.email));
      for (let i = 0; i < result.length; i++) {
         expect(result[i]).toMatchObject({
            accountId: expectedRoots[i]!.accountId,
            email: expectedRoots[i]!.email,
         });
      }
   });

   // -------------------------------------------------------------------------
   // 5. Window functions
   // -------------------------------------------------------------------------
   test("window: ROW_NUMBER() — rank orders per account by createdAt", async () => {
      const accountIds = dataManager.rootAccounts.slice(0, 3).map((a) => a.accountId);

      const result = await sql`
         select
            ${row(
               Order.$orderId,
               Order.$accountId,
               Order.$createdAt,
               val`row_number() over (partition by ${Order.$accountId} order by ${Order.$createdAt})`.as<{
                  rn: number;
               }>("rn"),
            )}
         from ${Order}
         where ${Order.$accountId} in (${accountIds})
         order by ${Order.$accountId}, rn
      `.mssql.getAll({ db: pool.request() });

      const byAccount = Map.groupBy(result, (r) => r.accountId);
      expect(byAccount.size).toBe(3);
      for (const [accountId, rows] of byAccount) {
         expect(accountIds).toContain(accountId);
         expect(rows).toHaveLength(dataManager.ACCOUNT_ORDER_FACTOR);
         expect(rows.map((r) => Number(r.rn))).toEqual(
            Array.from({ length: dataManager.ACCOUNT_ORDER_FACTOR }, (_, i) => i + 1),
         );
         for (const row_ of rows) {
            expect(row_).toMatchObject({
               orderId: expect.any(String),
               accountId,
               createdAt: expect.any(Date),
            });
         }
      }
   });

   test("window: RANK() — rank accounts by total order count", async () => {
      const accountIds = dataManager.rootAccounts.map((a) => a.accountId);

      const result = await sql`
         with order_counts as (
            select
               ${Order.$accountId.as("account_id")},
               count(*) as order_count
            from ${Order}
            where ${Order.$accountId} in (${accountIds})
            group by ${Order.$accountId}
         )
         select
            ${row(
               Account.$accountId,
               Account.$email,
               val`oc.order_count`.as<{ orderCount: number }>("orderCount"),
               val`rank() over (order by oc.order_count desc)`.as<{ rnk: number }>("rnk"),
            )}
         from ${Account}
         join order_counts oc on oc.account_id = ${Account.$accountId}
         order by rnk, ${Account.$email}
      `.mssql.getAll({ db: pool.request() });

      expect(result).toHaveLength(dataManager.ACCOUNT_ROOT_COUNT);
      const expectedRootsSorted = dataManager.rootAccounts.slice().sort((a, b) => a.email.localeCompare(b.email));
      for (let i = 0; i < result.length; i++) {
         expect(result[i]).toMatchObject({
            accountId: expectedRootsSorted[i]!.accountId,
            email: expectedRootsSorted[i]!.email,
         });
         expect(Number(result[i]!.rnk)).toBe(1);
         expect(Number(result[i]!.orderCount)).toBe(dataManager.ACCOUNT_ORDER_FACTOR);
      }
   });

   test("window: SUM() OVER — running total of order items per account", async () => {
      const account = dataManager.rootAccounts[0]!;
      ok(account);

      const result = await sql`
         select
            ${row(
               OrderItem.$orderId,
               OrderItem.$productId,
               OrderItem.$quantity,
               val`sum(${OrderItem.$quantity}) over (partition by ${Order.$accountId} order by ${OrderItem.$productId})`.as<{
                  runningQty: number;
               }>("runningQty"),
            )}
         from ${OrderItem}
         join ${Order} on ${Order.$orderId} = ${OrderItem.$orderId}
         where ${Order.$accountId} = ${account.accountId}
         order by ${OrderItem.$productId}
      `.mssql.getAll({ db: pool.request() });

      const expectedOrderIds = dataManager.orders
         .filter((o) => o.accountId === account.accountId)
         .map((o) => o.orderId);
      expect(result.length).toBeGreaterThan(0);
      let prev = 0;
      for (const row_ of result) {
         expect(row_).toMatchObject({
            orderId: expect.any(String),
            productId: expect.any(String),
            quantity: expect.any(Number),
         });
         expect(expectedOrderIds).toContain(row_.orderId);
         expect(Number(row_.runningQty)).toBeGreaterThanOrEqual(prev);
         prev = Number(row_.runningQty);
      }
   });

   test("window: LAG() — compare each order's creation time to the previous one", async () => {
      const account = dataManager.rootAccounts[0]!;
      ok(account);

      const result = await sql`
         select
            ${row(
               Order.$orderId,
               Order.$accountId,
               Order.$createdAt,
               val`lag(${Order.$createdAt}) over (partition by ${Order.$accountId} order by ${Order.$createdAt})`.as<{
                  prevCreatedAt: Date | null;
               }>("prevCreatedAt"),
            )}
         from ${Order}
         where ${Order.$accountId} = ${account.accountId}
         order by ${Order.$createdAt}, ${Order.$orderId}
      `.mssql.getAll({ db: pool.request() });

      const expectedOrders = dataManager.orders
         .filter((o) => o.accountId === account.accountId)
         .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.orderId.localeCompare(b.orderId));
      expect(result).toHaveLength(dataManager.ACCOUNT_ORDER_FACTOR);
      const first = result.find((r) => r.prevCreatedAt === null)!;
      const second = result.find((r) => r.prevCreatedAt !== null)!;
      ok(first, "expected a row with prevCreatedAt = null");
      ok(second, "expected a row with prevCreatedAt != null");
      expect(expectedOrders.map((o) => o.orderId)).toContain(first.orderId);
      expect(expectedOrders.map((o) => o.orderId)).toContain(second.orderId);
      expect(first.accountId).toBe(account.accountId);
      expect(second.accountId).toBe(account.accountId);
      expect(second.prevCreatedAt).toEqual(first.createdAt);
   });

   test("window: NTILE() — bucket order items into quartiles by price", async () => {
      const accountIds = dataManager.rootAccounts.map((a) => a.accountId);

      const result = await sql`
         select
            ${row(
               OrderItem.$orderId,
               OrderItem.$productPrice,
               val`ntile(4) over (order by ${OrderItem.$productPrice})`.as<{ quartile: number }>("quartile"),
            )}
         from ${OrderItem}
         join ${Order} on ${Order.$orderId} = ${OrderItem.$orderId}
         where ${Order.$accountId} in (${accountIds})
         order by ${OrderItem.$productPrice}
      `.mssql.getAll({ db: pool.request() });

      expect(result.length).toBeGreaterThan(0);
      for (const row_ of result) {
         expect(row_).toMatchObject({
            orderId: expect.any(String),
            productPrice: expect.any(Number),
         });
         expect(Number(row_.quartile)).toBeGreaterThanOrEqual(1);
         expect(Number(row_.quartile)).toBeLessThanOrEqual(4);
      }
      const quartiles = result.map((r) => Number(r.quartile));
      for (let i = 1; i < quartiles.length; i++) {
         expect(quartiles[i]).toBeGreaterThanOrEqual(quartiles[i - 1]!);
      }
   });
});
