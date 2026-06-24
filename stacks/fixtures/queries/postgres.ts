// noinspection SqlNoDataSourceInspection,SqlResolve
import "@vexnor/postgres";
import { sql, row, param, col, ctx, set, insert, filterBy, orderBy, when } from "@vexnor/core";
import { Account } from "../codegen/postgres/vexnor_dev.account-table.js";
import { Order } from "../codegen/postgres/vexnor_dev.order-table.js";
import { OrderItem } from "../codegen/postgres/vexnor_dev.order_item-table.js";

// ─── param() — scalar params ────────────────────────────────────────────────

export const selectByStatus = sql`
   SELECT ${row(Account.$$)}
   FROM ${Account}
   WHERE ${Account.$status} = ${param<{ status: string }>("status")}
`;

export const selectByMultipleParams = sql`
   SELECT ${row(Account.$$)}
   FROM ${Account}
   WHERE ${Account.$email} = ${param<{ email: string; status: string }>("email")}
   AND ${Account.$status} = ${param<{ email: string; status: string }>("status")}
`;

// ─── param() — array param (IN-list expansion) ──────────────────────────────

export const selectByIds = sql`
   SELECT ${row(Account.$$)}
   FROM ${Account}
   WHERE ${Account.$accountId} IN (${param<{ ids: string[] }>("ids")})
`;

// ─── filter() — dynamic WHERE from object ───────────────────────────────────

export const selectWithFilter = sql`
   SELECT ${row(Account.$$)}
   FROM ${Account}
   WHERE ${filterBy(Account, "filter")}
`;

// ─── filter() with CRUD .select() ───────────────────────────────────────────

export const selectAccountsCrud = Account.postgres.select({
   ORDER_BY: sql`${Account.$createdAt} DESC`,
});

// ─── when() — conditional WHERE clause ──────────────────────────────────────

type ConditionalP = { status: string; hasEmail: boolean; email: string; hasName: boolean; firstName: string };

export const selectConditional = sql`
   SELECT ${row(Account.$$)}
   FROM ${Account}
   WHERE ${Account.$status} = ${param<ConditionalP>("status")}
   ${when("hasEmail", sql`AND ${Account.$email} = ${param<ConditionalP>("email")}`)}
   ${when("hasName", sql`AND ${Account.$firstName} = ${param<ConditionalP>("firstName")}`)}
`;

// ─── when() — binary branch (ASC/DESC) ──────────────────────────────────────

type SortDirP = { status: string; sortAsc: boolean };

export const selectWithSortDirection = sql`
   SELECT ${row(Account.$$)}
   FROM ${Account}
   WHERE ${Account.$status} = ${param<SortDirP>("status")}
   ORDER BY ${Account.$createdAt} ${when("sortAsc", sql`ASC`, sql`DESC`)}
`;

// ─── orderBy() — dynamic ORDER BY column + direction ────────────────────────

export const selectOrdered = sql`
   SELECT ${row(Account.$$)}
   FROM ${Account}
   ${orderBy(Account)}
`;

// ─── set() — UPDATE with dynamic columns ────────────────────────────────────

export const updateAccount = sql`
   UPDATE ${Account}
   ${set(Account)}
   WHERE ${Account.$accountId} = ${param<{ set: Record<string, unknown>; accountId: string }>("accountId")}
   RETURNING ${row(Account.$$)}
`;

// ─── insert() — INSERT with dynamic rows ────────────────────────────────────

export const insertAccounts = sql`
   INSERT INTO ${Account}
   ${insert(Account, "rows")}
   RETURNING ${row(Account.$$)}
`;

// ─── insert.cols() + insert.values() — split form ───────────────────────────

export const insertAccountsSplit = sql`
   INSERT INTO ${Account}
   (${insert.cols(Account, "rows")})
   VALUES ${insert.values(Account, "rows")}
   RETURNING ${row(Account.$$)}
`;

// ─── Subqueries with .out reference ─────────────────────────────────────────

const accountOrders = sql`
   SELECT ${row(Order.$$)}
   FROM ${Order}
   WHERE ${Order.$accountId} = ${Account.out.$accountId}
   ORDER BY ${Order.$createdAt} DESC
`;

const orderItems = sql`
   SELECT ${row(OrderItem.$$)}
   FROM ${OrderItem}
   WHERE ${OrderItem.$orderId} = ${Order.out.$orderId}
`;

// ─── CRUD .select() with includeMany ────────────────────────────────────────

export const selectAccountsWithOrders = Account.postgres.select({
   WHERE: sql`${Account.$status} = ${param<{ status: string }>("status")}`,
   ORDER_BY: sql`${Account.$createdAt} DESC`,
   includeMany: { orders: accountOrders },
});

// ─── CRUD .select() with includeOne ─────────────────────────────────────────

export const selectAccountsWithLastOrder = Account.postgres.select({
   WHERE: sql`${Account.$status} = ${param<{ status: string }>("status")}`,
   ORDER_BY: sql`${Account.$createdAt} DESC`,
   includeOne: { lastOrder: accountOrders },
});

// ─── CRUD .select() with custom SELECT + subquery scalar ────────────────────

export const selectAccountsWithOrderCount = Account.postgres.select({
   SELECT: sql`${row(Account.$$)}, (SELECT count(*) FROM ${Order} WHERE ${Order.$accountId} = ${Account.$accountId}) AS ${col<{ orderCount: number }>("orderCount")}`,
   ORDER_BY: sql`${Account.$createdAt} DESC`,
});

// ─── ctx() — server-injected context param ──────────────────────────────────

export const selectMyOrders = Order.postgres.select({
   WHERE: sql`${Order.$accountId} = ${ctx<{ userId: string }>("userId")}`,
   ORDER_BY: sql`${Order.$createdAt} DESC`,
   includeMany: { items: orderItems },
});

// ─── CRUD insertRows() ──────────────────────────────────────────────────────

export const insertAccountCrud = Account.postgres.insertRows();

// ─── CRUD update() with WHERE ───────────────────────────────────────────────

export const updateAccountCrud = Account.postgres.update({
   WHERE: sql`${Account.$accountId} = ${param<{ accountId: string }>("accountId")}`,
});

// ─── CRUD delete() with WHERE ───────────────────────────────────────────────

export const deleteAccount = Account.postgres.delete({
   WHERE: sql`${Account.$accountId} = ${param<{ accountId: string }>("accountId")}`,
});

// ─── Combined: filter + orderBy + when in same query ────────────────────────

type ComplexP = { filter?: Record<string, unknown>; hasLimit: boolean; limit: number };

export const selectComplex = sql`
   SELECT ${row(Account.$$)}
   FROM ${Account}
   WHERE ${filterBy(Account, "filter")}
   ${orderBy(Account)}
   ${when("hasLimit", sql`LIMIT ${param<ComplexP>("limit")}`)}
`;
