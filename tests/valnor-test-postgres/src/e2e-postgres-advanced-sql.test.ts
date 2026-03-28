import { beforeAll, describe, expect, test } from "vitest";
import { ok } from "node:assert";
import { col, row } from "valnor";
import { jsonMany, sql } from "valnor-postgres";
import { Account } from "./codegen/valnor_test.account-table.js";
import { Order } from "./codegen/valnor_test.order-table.js";
import { OrderItem } from "./codegen/valnor_test.order_item-table.js";
import { pool } from "./postgres-pool.js";
import { TestDataManager } from "./test-data-manager.js";

describe.sequential("advanced SQL - postgres", async (ctx) => {
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
        select ${row(Account.$$)}, 0 as ${col<{ depth: number }>("depth")}
        from ${Account}
        where ${Account.$accountId} = ${root.accountId}
      `;

      const hierarchy = sql`
         ${anchor} union all
         select ${row(Account.as("b").$$)}, ${anchor.out.$depth} + 1 as ${col<{ depth: number }>("depth")}
         from ${Account.as("b")}
                 join ${anchor.out} on ${anchor.out.$accountId} = ${Account.as("b").$parentId}
      `;
      ok(hierarchy.$depth, `'hierarchy.$depth' is required: ${hierarchy.$depth}`);

      const query = sql`
         with recursive ${hierarchy}
         select ${row(hierarchy.$$)} from ${hierarchy}
         order by ${hierarchy.$depth}, ${hierarchy.$email}
      `;
      const { text } = query.getSql({});
      expect(text).toMatchInlineSnapshot(`
        "/* <query_0> */
        WITH RECURSIVE
          "query_1" AS (
            /* <query_1> */
            /* <query_2> */
            SELECT
              "a_1"."account_id" AS "accountId",
              "a_1"."status",
              "a_1"."email",
              "a_1"."first_name" AS "firstName",
              "a_1"."last_name" AS "lastName",
              "a_1"."notes",
              "a_1"."created_at" AS "createdAt",
              "a_1"."modified_at" AS "modifiedAt",
              "a_1"."parent_id" AS "parentId",
              0 AS "depth"
            FROM
              "valnor_test"."account" AS "a_1"
            WHERE
              "a_1"."account_id" = $1
              /* </query_2> */
            UNION ALL
            SELECT
              "b"."account_id" AS "accountId",
              "b"."status",
              "b"."email",
              "b"."first_name" AS "firstName",
              "b"."last_name" AS "lastName",
              "b"."notes",
              "b"."created_at" AS "createdAt",
              "b"."modified_at" AS "modifiedAt",
              "b"."parent_id" AS "parentId",
              "query_1"."depth" + 1 AS "depth"
            FROM
              "valnor_test"."account" AS "b"
              JOIN "query_1" ON "query_1"."accountId" = "b"."parent_id"
              /* </query_1> */
          )
        SELECT
          "query_1".*
        FROM
          "query_1"
        ORDER BY
          "query_1"."depth",
          "query_1"."email"
          /* </query_0> */"
      `);
      const result = await query.postgres.all({ db: pool });

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

   test("recursive CTE: collect all descendant ids into an array", async () => {
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
         with recursive ${descendants}
         select array_agg(${descendants.$accountId}) as ${col<{ ids: string[] }>("ids")}
         from ${descendants}
      `.postgres.one({ db: pool });

      const expectedChildIds = dataManager.childAccounts
         .filter((c) => c.parentId === root.accountId)
         .map((c) => c.accountId)
         .sort();
      expect(result).toMatchObject({ ids: expect.arrayContaining(expectedChildIds) });
      expect(result.ids).toHaveLength(expectedChildIds.length);
   });

   // -------------------------------------------------------------------------
   // 2. Multi-table join with aggregates (GROUP BY + HAVING)
   //    account → order → order_item → product
   // -------------------------------------------------------------------------
   test("multi-table join + GROUP BY + HAVING: accounts with total spend > 0", async () => {
      const accountIds = dataManager.rootAccounts.map((a) => a.accountId);
      const expectedAccounts = dataManager.rootAccounts.slice().sort((a, b) => a.email.localeCompare(b.email));

      const result = await sql`
         select
            ${row(Account.$accountId, Account.$email)},
            count(distinct ${Order.$orderId}) as ${col<{ orderCount: number }>("orderCount")},
            sum(${OrderItem.$quantity} * ${OrderItem.$productPrice}::numeric) as ${col<{ totalSpend: string }>("totalSpend")},
            count(distinct ${OrderItem.$productId}) as ${col<{ distinctProducts: number }>("distinctProducts")}
         from ${Account}
         join ${Order} on ${Order.$accountId} = ${Account.$accountId}
         join ${OrderItem} on ${OrderItem.$orderId} = ${Order.$orderId}
         where ${Account.$accountId} in (${accountIds})
         group by ${Account.$accountId}, ${Account.$email}
         having count(distinct ${Order.$orderId}) > 0
         order by ${Account.$email}
      `.all({ db: pool });

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
            ${row(Account.$accountId)},
            count(distinct ${OrderItem.$productId}) as ${col<{ distinctProducts: number }>("distinctProducts")}
         from ${Account}
         join ${Order} on ${Order.$accountId} = ${Account.$accountId}
         join ${OrderItem} on ${OrderItem.$orderId} = ${Order.$orderId}
         where ${Account.$accountId} in (${accountIds})
         group by ${Account.$accountId}
         having count(distinct ${OrderItem.$productId}) > 1
      `.all({ db: pool });

      // ORDER_ITEM_FACTOR=2 with 2 different products per order → always > 1
      expect(result).toHaveLength(dataManager.ACCOUNT_ROOT_COUNT);
      const expectedAccountIds = dataManager.rootAccounts.map((a) => a.accountId);
      for (const row_ of result) {
         expect(expectedAccountIds).toContain(row_.accountId);
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
      `;

      const AccountOrders = sql`
         select
            ${row(Order.$orderId, Order.$status, Order.$createdAt)},
            ${jsonMany(OrderItems).as("items")}
         from ${Order} ${jsonMany(OrderItems)}
         where ${Order.$accountId} = ${Account.out.$accountId}
         order by ${Order.$createdAt}
      `;

      const result = await sql`
         select ${row(Account.$accountId, Account.$email)},
                ${jsonMany(AccountOrders).as("orders")}
         from ${Account} ${jsonMany(AccountOrders)}
         where ${Account.$accountId} = ${root.accountId}
      `.one({ db: pool });

      expect(result).toMatchObject({ accountId: root.accountId, email: root.email });
      expect(result.orders).toHaveLength(dataManager.ACCOUNT_ORDER_FACTOR);
      const expectedOrders = dataManager.orders.filter((o) => o.accountId === root.accountId);
      for (const order of result.orders) {
         const expectedOrder = expectedOrders.find((o) => o.orderId === order.orderId)!;
         ok(expectedOrder);
         expect(order).toMatchObject({
            orderId: expectedOrder.orderId,
            status: expectedOrder.status,
         });
         expect(order.items).toHaveLength(dataManager.ORDER_ITEM_FACTOR);
         const expectedItems = dataManager.orderItems.filter((i) => i.orderId === order.orderId);
         for (const item of order.items) {
            const expectedItem = expectedItems.find((i) => i.productId === item.productId)!;
            ok(expectedItem);
            expect(item).toMatchObject({
               orderId: order.orderId,
               productId: expectedItem.productId,
               quantity: expectedItem.quantity,
            });
         }
      }
   });

   test("nested jsonMany: multiple accounts each with nested orders+items", async () => {
      const accountIds = dataManager.rootAccounts.slice(0, 3).map((a) => a.accountId);

      const OrderItems = sql`
         select ${row(OrderItem.$orderId, OrderItem.$productId, OrderItem.$quantity)}
         from ${OrderItem}
         where ${OrderItem.$orderId} = ${Order.out.$orderId}
      `;

      const AccountOrders = sql`
         select ${row(Order.$orderId, Order.$accountId)},
                ${jsonMany(OrderItems).as("items")}
         from ${Order} ${jsonMany(OrderItems)}
         where ${Order.$accountId} = ${Account.out.$accountId}
      `;

      const results = await sql`
         select ${row(Account.$accountId)}, ${jsonMany(AccountOrders).as("orders")}
         from ${Account} ${jsonMany(AccountOrders)}
         where ${Account.$accountId} in (${accountIds})
         order by ${Account.$email}
      `.all({ db: pool });

      expect(results).toHaveLength(3);
      for (const account of results) {
         expect(accountIds).toContain(account.accountId);
         expect(account.orders).toHaveLength(dataManager.ACCOUNT_ORDER_FACTOR);
         const expectedAccountOrders = dataManager.orders.filter((o) => o.accountId === account.accountId);
         for (const order of account.orders) {
            const expectedOrder = expectedAccountOrders.find((o) => o.orderId === order.orderId)!;
            ok(expectedOrder);
            expect(order).toMatchObject({ orderId: expectedOrder.orderId, accountId: account.accountId });
            expect(order.items).toHaveLength(dataManager.ORDER_ITEM_FACTOR);
            const expectedItems = dataManager.orderItems.filter((i) => i.orderId === order.orderId);
            for (const item of order.items) {
               const expectedItem = expectedItems.find((i) => i.productId === item.productId)!;
               ok(expectedItem);
               expect(item).toMatchObject({
                  orderId: order.orderId,
                  productId: expectedItem.productId,
                  quantity: expectedItem.quantity,
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
      `.all({ db: pool });

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
      // insert an account with no orders
      const orphan = await sql`
         insert into ${Account}
            ${Account.insertColsVals({
               email: `orphan-${dataManager.TAG}@example.com`,
               firstName: "Orphan",
               lastName: dataManager.TAG,
            })}
            returning ${row(Account.$$)}
      `.one({ db: pool });

      const result = await sql`
         select ${row(Account.$$)}
         from ${Account}
         where ${Account.$lastName} = ${dataManager.TAG}
           and ${Account.$accountId} not in (
              select ${Order.$accountId} from ${Order}
           )
      `.all({ db: pool });

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
      // mark one order as paid
      const order = dataManager.orders[0]!;
      ok(order);
      await sql`
         update ${Order}
         set ${Order.$status} = 'paid'
         where ${Order.$orderId} = ${order.orderId}
      `.run({ db: pool });

      const result = await sql`
         select ${row(Account.$$)}
         from ${Account}
         where exists (
            select 1 from ${Order}
            where ${Order.$accountId} = ${Account.$accountId}
              and ${Order.$status} = 'paid'
         )
         order by ${Account.$email}
      `.all({ db: pool });

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
      `.all({ db: pool });

      // all root accounts have children, and all children have orders
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
            ${row(Order.$orderId, Order.$accountId, Order.$createdAt)},
            row_number() over (partition by ${Order.$accountId} order by ${Order.$createdAt}, ${Order.$orderId}) as ${col<{ rn: number }>("rn")}
         from ${Order}
         where ${Order.$accountId} in (${accountIds})
         order by ${Order.$accountId}, rn
      `.all({ db: pool });

      // each account has ACCOUNT_ORDER_FACTOR orders → rn goes 1..ACCOUNT_ORDER_FACTOR
      const byAccount = Map.groupBy(result, (r) => r.accountId);
      expect(byAccount.size).toBe(3);
      for (const [accountId, rows] of byAccount) {
         expect(accountIds).toContain(accountId);
         expect(rows).toHaveLength(dataManager.ACCOUNT_ORDER_FACTOR);
         expect(rows.map((r) => Number(r.rn))).toEqual(
            Array.from({ length: dataManager.ACCOUNT_ORDER_FACTOR }, (_, i) => i + 1),
         );
         // rows are ordered by rn (= createdAt asc, orderId asc tiebreaker)
         // verify each row belongs to this account and has the right rn
         for (let j = 0; j < rows.length; j++) {
            expect(rows[j]).toMatchObject({ accountId, rn: String(j + 1) });
            expect(dataManager.orders.some((o) => o.orderId === rows[j]!.orderId)).toBe(true);
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
            ${row(Account.$accountId, Account.$email)},
            oc.order_count as ${col<{ orderCount: number }>("orderCount")},
            rank() over (order by oc.order_count desc) as ${col<{ rnk: number }>("rnk")}
         from ${Account}
         join order_counts oc on oc.account_id = ${Account.$accountId}
         order by ${col<{ rnk: number }>("rnk")}, ${Account.$email}
      `.all({ db: pool });

      expect(result).toHaveLength(dataManager.ACCOUNT_ROOT_COUNT);
      const expectedRootsSorted = dataManager.rootAccounts.slice().sort((a, b) => a.email.localeCompare(b.email));
      // all accounts have the same order count → all rank 1, ordered by email
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
            ${row(OrderItem.$orderId, OrderItem.$productId, OrderItem.$quantity)},
            sum(${OrderItem.$quantity}) over (partition by ${Order.$accountId} order by ${OrderItem.$productId}) as ${col<{ runningQty: number }>("runningQty")}
         from ${OrderItem}
         join ${Order} on ${Order.$orderId} = ${OrderItem.$orderId}
         where ${Order.$accountId} = ${account.accountId}
         order by ${OrderItem.$productId}
      `.all({ db: pool });

      const expectedOrderIds = dataManager.orders
         .filter((o) => o.accountId === account.accountId)
         .map((o) => o.orderId);
      expect(result.length).toBeGreaterThan(0);
      // running total must be non-decreasing
      let prev = 0;
      for (const row_ of result) {
         expect(expectedOrderIds).toContain(row_.orderId);
         const expectedItem = dataManager.orderItems.find(
            (i) => i.orderId === row_.orderId && i.productId === row_.productId,
         )!;
         ok(expectedItem);
         expect(row_).toMatchObject({
            orderId: expectedItem.orderId,
            productId: expectedItem.productId,
            quantity: expectedItem.quantity,
         });
         expect(Number(row_.runningQty)).toBeGreaterThanOrEqual(prev);
         prev = Number(row_.runningQty);
      }
   });

   test("window: LAG() — compare each order's creation time to the previous one", async () => {
      const account = dataManager.rootAccounts[0]!;
      ok(account);

      const result = await sql`
         select
            ${row(Order.$orderId, Order.$accountId, Order.$createdAt)},
            lag(${Order.$createdAt}) over (partition by ${Order.$accountId} order by ${Order.$createdAt}, ${Order.$orderId}) as ${col<{ prevCreatedAt: Date | null }>("prevCreatedAt")}
         from ${Order}
         where ${Order.$accountId} = ${account.accountId}
         order by ${Order.$createdAt}, ${Order.$orderId}
      `.all({ db: pool });

      expect(result).toHaveLength(dataManager.ACCOUNT_ORDER_FACTOR);
      // first row has no previous
      expect(result[0]).toMatchObject({ accountId: account.accountId, prevCreatedAt: null });
      expect(dataManager.orders.some((o) => o.orderId === result[0]!.orderId)).toBe(true);
      // second row's prevCreatedAt matches first row's createdAt
      expect(result[1]).toMatchObject({
         accountId: account.accountId,
         prevCreatedAt: result[0]!.createdAt,
      });
      expect(dataManager.orders.some((o) => o.orderId === result[1]!.orderId)).toBe(true);
   });

   test("window: NTILE() — bucket order items into quartiles by price", async () => {
      const accountIds = dataManager.rootAccounts.map((a) => a.accountId);

      const result = await sql`
         select
            ${row(OrderItem.$orderId, OrderItem.$productPrice)},
            ntile(4) over (order by ${OrderItem.$productPrice}::numeric) as ${col<{ quartile: number }>("quartile")}
         from ${OrderItem}
         join ${Order} on ${Order.$orderId} = ${OrderItem.$orderId}
         where ${Order.$accountId} in (${accountIds})
         order by ${OrderItem.$productPrice}::numeric
      `.all({ db: pool });

      expect(result.length).toBeGreaterThan(0);
      for (const row_ of result) {
         const expectedItem = dataManager.orderItems.find((i) => i.orderId === row_.orderId)!;
         ok(expectedItem);
         expect(row_).toMatchObject({
            orderId: expectedItem.orderId,
            productPrice: row_.productPrice,
         });
         expect(Number(row_.quartile)).toBeGreaterThanOrEqual(1);
         expect(Number(row_.quartile)).toBeLessThanOrEqual(4);
      }
      // prices are ordered ascending — quartiles must be non-decreasing
      const quartiles = result.map((r) => Number(r.quartile));
      for (let i = 1; i < quartiles.length; i++) {
         expect(quartiles[i]).toBeGreaterThanOrEqual(quartiles[i - 1]!);
      }
   });
});
