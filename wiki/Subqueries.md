# Subqueries and Query Composition

Build complex SQL queries by composing reusable subqueries with full type safety.

## Overview

Valnor allows you to create reusable SQL building blocks that can be composed into larger queries. The type system ensures all parameters from subqueries are properly handled in the parent query.

## Basic Subquery Example

```typescript
import { sql, param } from "valnor";
import { Users, IUsersSelect } from "./models/users";

// Create a reusable subquery
const UsersInCity = sql<IUsersSelect, { city: string }>`
    SELECT ${Users.$$all}
    FROM ${Users}
    WHERE ${Users.city} = ${param("city")}
`;

// Compose it into a larger query with additional filtering
const query = sql<IUsersSelect, { age: number; city: string }>`
    SELECT ${UsersInCity.ROW.$$all}
    FROM (${UsersInCity})
    WHERE ${UsersInCity.ROW.age} > ${param("age")}
`;

// Execute with all required parameters
const results = await query.many(db, { 
    age: 21, 
    city: "Munich" 
});
```

## Key Concepts

### Parameter Merging

When using subqueries, the parent query must include **all parameters** from all subqueries:

```typescript
// Subquery requires { city: string }
const UsersInCity = sql<IUsersSelect, { city: string }>`
    SELECT ${Users.$$all}
    FROM ${Users}
    WHERE ${Users.city} = ${param("city")}
`;

// Parent query must include both { age: number } AND { city: string }
const query = sql<IUsersSelect, { age: number; city: string }>`
    SELECT ${UsersInCity.ROW.$$all}
    FROM (${UsersInCity})
    WHERE ${UsersInCity.ROW.age} > ${param("age")}
`;
```

**Compile-time safety**: TypeScript will error if you forget to include subquery parameters.

### Building Blocks with Sql<TRow, TParams>

Use the `Sql<TRow, TParams>` type to create reusable query components:

```typescript
// Reusable filter functions
import {Users} from "./users-model";

const UsersByCity = sql<IUsersSelect, { city: string }>`
    SELECT ${Users.$$all} 
    FROM ${Users} 
    WHERE ${Users.city} = ${param("city")}
`;

const UsersByAge = sql<IUsersSelect, { minAge: number }>`
    SELECT ${Users.$$all} 
    FROM ${Users} 
    WHERE ${Users.age} >= ${param("minAge")}
`;

// Compose multiple subqueries
const ComplexQuery = sql<IUsersSelect, {
    minAge: number;
    city: string
}>`
    SELECT ${UsersByCity.ROW.$$all}
    FROM (${UsersByCity})
        JOIN (${UsersByAge}) on ${UsersByCity.userId} = ${UsersByAge.userId}
    WHERE ${UsersByCity.ROW.age} >= ${param("minAge")}
`;

// Master query using both subqueries
const results = await ComplexQuery.many(db, {
    city: "Berlin",
    minAge: 25
});
```

## Advanced Composition

### Nested Subqueries

```typescript
const YoungUsers = sql<IUsersSelect, { maxAge: number }>`
    SELECT ${Users.$$all}
    FROM ${Users}
    WHERE ${Users.age} <= ${param("maxAge")}
`;

const YoungUsersInCity = sql<IUsersSelect, { maxAge: number; city: string }>`
    SELECT ${YoungUsers.ROW.$$all}
    FROM (${YoungUsers})
    WHERE ${YoungUsers.ROW.city} = ${param("city")}
`;
```

### Conditional Subqueries

```typescript
function buildUserQuery(includeAllAges: boolean) {
    const baseQuery = sql<IUsersSelect>`SELECT ${Users.$$all} FROM ${Users}`;
    
    if (includeAllAges) {
        return baseQuery;
    }
    
    return sql<IUsersSelect, { minAge: number }>`
        SELECT ${baseQuery.$$all}
        FROM (${baseQuery}) 
        WHERE ${baseQuery.ROW.age} >= ${param("minAge")}
    `;
}
```

## Benefits

✅ **Type Safety** - All parameters tracked at compile time  
✅ **Reusability** - Build once, use everywhere  
✅ **Composability** - Mix and match query components  
✅ **Performance** - Queries are prepared once and reused  
✅ **Maintainability** - Complex logic broken into smaller pieces

## Best Practices

1. **Name subqueries descriptively** - `UsersInCity` vs `query1`
2. **Keep subqueries focused** - Single responsibility principle
3. **Use type aliases** - Define common parameter shapes
4. **Test subqueries independently** - Unit test building blocks

```typescript
// Good: Focused, reusable subqueries
const UsersInCity = sql<IUsersSelect, { city: string }>`
    SELECT ${Users.$$all} FROM ${Users} WHERE ${Users.city} = ${param("city")}
`;
const UsersByAge = sql<IUsersSelect, { minAge: number }>`
    SELECT ${Users.$$all} FROM ${Users} WHERE ${Users.age} >= ${param("minAge")}
`;

// Better: With type aliases
type CityFilter = { city: string };
type AgeFilter = { minAge: number };

const UsersInCity = sql<IUsersSelect, CityFilter>`
    SELECT ${Users.$$all} FROM ${Users} WHERE ${Users.city} = ${param("city")}
`;
const UsersByAge = sql<IUsersSelect, AgeFilter>`
    SELECT ${Users.$$all} FROM ${Users} WHERE ${Users.age} >= ${param("minAge")}
`;
```

## See Also

- [Type-Safe Query Examples](Type-Safe-Query-Examples.md) - Basic query patterns
- [Features](Features.md) - Complete feature overview
- [Usage](Usage.md) - CLI and configuration options