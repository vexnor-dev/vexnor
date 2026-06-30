# Schema Graph

`SchemaGraph` provides FK-based schema introspection and automatic join path resolution. It accepts a record of vexnor `SqlTable` instances and builds a bidirectional FK graph for BFS shortest-path discovery between any two tables.

```ts
import { SchemaGraph } from "@vexnor/core/execution";
```

## Usage

```ts
import { SchemaGraph } from "@vexnor/core/execution";
import * as schema from "./models";

const graph = new SchemaGraph(schema);

// List all tables (excludes views and partitions)
graph.tables();
// → ["public.actor", "public.address", "public.city", ...]

// Get table introspection info
graph.table("public.payment");
// → { name: "payment", schema: "public", columns: [...], pk: ["paymentId"], fk: [...] }

// Resolve FK join path (BFS shortest path)
graph.joinPath("public.payment", "public.city");
// → [{ from: { table: "payment", column: "customerId" }, to: { table: "customer", column: "customerId" } },
//    { from: { table: "customer", column: "addressId" }, to: { table: "address", column: "addressId" } },
//    { from: { table: "address", column: "cityId" }, to: { table: "city", column: "cityId" } }]
```

## Join Resolution

`SchemaGraph` can compose multi-table join queries at runtime using BFS-resolved FK paths:

```ts
// By string identifiers
const result = graph.joinBy("public.payment", [
   { table: "public.customer" },
   { table: "public.city", type: "left" },
]);
// → { query, joinBy, tables, columns }

// By SqlTable instances
const result = graph.join({
   root: Payment,
   targets: [
      { table: Customer },
      { table: City, type: "left" },
   ],
});
```

The returned `JoinResult` contains:
- `query` — a composed `SqlQuery` ready for registration in `SqlQueryRegistry`
- `joinBy` — the exact joinBy params to pass to `fetchData` (or auto-inject)
- `tables` — ordered list of table IDs in the join
- `columns` — all available columns (root cols bare, joined cols as `"table.col"`)

## AI Prompt Formatting

`SchemaGraph` includes methods to produce compact text for LLM system prompts:

```ts
// Full schema overview (one line per table)
graph.formatOverview();
// → "public.payment(paymentId, customerId, amount) pk:paymentId fk:customerId→public.customer"

// Single table detail
graph.formatTable("public.payment");
// → "Table: public.payment\n  columns: paymentId(integer), ...\n  pk: paymentId\n  fk: customerId → public.customer.customerId"

// Relationship graph
graph.formatRelationships();
// → "public.payment → public.customer(customerId)\npublic.customer → public.address(addressId)"
```

## Table Filtering

`SchemaGraph` automatically excludes:
- **Views** — entities without primary keys
- **Partitions** — tables with `_p20` or `_p0000` in their name (PostgreSQL partition naming)

Only base tables with declared PKs are included in the graph.

## API Reference

| Method | Returns | Description |
|--------|---------|-------------|
| `tables()` | `string[]` | All table IDs sorted alphabetically |
| `table(id)` | `TableInfo \| null` | Full introspection info for a table |
| `resolve(id)` | `SqlTableAny \| null` | The underlying SqlTable instance |
| `joinPath(from, to)` | `JoinStep[] \| null` | BFS shortest FK path between two tables |
| `join(args)` | `JoinResult \| null` | Compose a join query from SqlTable instances |
| `joinBy(from, targets)` | `JoinResult \| null` | Compose a join query from string identifiers |
| `formatTable(id)` | `string` | AI-friendly single table description |
| `formatRelationships()` | `string` | Compact FK relationship graph |
| `formatOverview()` | `string` | Full schema overview (one line per table) |

## Types

```ts
interface TableInfo {
   name: string;
   schema: string;
   columns: ColumnInfo[];
   pk: string[];
   fk: ForeignKey[];
}

interface JoinStep {
   from: { schema: string; table: string; column: string };
   to: { schema: string; table: string; column: string };
}

interface JoinResult {
   query: unknown;
   joinBy: Record<string, { on: [string, string, string][]; type?: JoinType }>;
   tables: string[];
   columns: string[];
}

type JoinType = "inner" | "left" | "right" | "full" | "cross";
```

## Cross-Runtime (Schema Manifest)

To use `SchemaGraph` outside of Node.js (e.g., in .NET), serialize your schema to a JSON manifest:

```typescript
import { serializeSchema } from 'vexnor';
import * as schema from './models/public.schema.js';

const manifest = serializeSchema(schema, 'postgresql');
// Write to disk for .NET or AI agent consumption
```

The .NET SDK loads this manifest to build its own `SchemaGraph` — resolving FK join paths and composing queries without a live database connection.

See [Serialize — Schema Manifest](serialize.md#schema-manifest) for the output format and build integration.  
See [.NET SDK](dotnet.md) for loading manifests and `QueryRegistry` usage.
