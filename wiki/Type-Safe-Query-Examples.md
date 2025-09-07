# Type-Safe Query Examples

## Insert Operation

```typescript
import {newOneSqlSchema} from "./codegen/one_sql.schema.js";

const {Account} = newOneSqlSchema(psql);

const [newAccount] = await sql`
    INSERT INTO ${Account}
        ${Account.$values({
            firstName: "John",
            lastName: "Doe",
            email: "john@example.com",
            status: AccountStatusUdt.CREATED
        })}
    RETURNING ${Account.$all}
`;
```

## Select Operation with Join

```typescript
import {
    AccountStatusUdt,
    IAccountSelect,
    IOrderJson,
    newOneSqlSchema,
    OrderStatusUdt,
} from "./codegen/one_sql.schema.js";

// create tables from existing schema: Account, Order 
const {Account, Order} = newOneSqlSchema(sql);

interface AccountWithOrders extends IAccountSelect {
    // need to use IOrderJson since "createdAt" is now a string due to JSON array aggregation
    orders: Pick<IOrderJson, "orderId" | "createdAt" | "status">[];
}

const accountWithOrders = await sql<AccountWithOrders, { accountId: number }>`
    SELECT ${Account.$all},
           COALESCE(
                jsonb_agg(orders.*) FILTER (WHERE orders.* IS NOT NULL),
                '[]'
           ) as orders
    FROM ${Account}
            LEFT JOIN LATERAL (
        SELECT ${Order.orderId}, ${Order.createdAt}, ${Order.status}
        FROM ${Order}
        WHERE ${Order.accountId} = ${Account.accountId}
        ORDER BY ${Order.createdAt} DESC
        LIMIT 5
    ) orders ON true
    WHERE ${Account.accountId} = ${param("accountId")}
    GROUP BY ${Account.accountId}`.one(db, { accountId: 101 });
```

## Update Operation

```typescript
const accountUpdated = await sql`
    UPDATE ${Account}
    SET ${Account.$set({
        status: AccountStatusUdt.CONFIRMED,
    })}
    WHERE ${Account.accountId} = ${accountId}
    RETURNING ${Account.$all}
`.one(db);
```