import {
   newSqlTableColumn,
   Sql,
   SqlBuildContext,
   SqlBuildOptions,
   SqlNestedColumnProperties,
   SqlTableColumnReference,
} from "@vexnor/core";

type DuckDBUnnestRelation<Item> = DuckDBUnnest<Item> & SqlNestedColumnProperties<NonNullable<Item>>;

export class DuckDBUnnestBuilder<Item> {
   constructor(readonly source: SqlTableColumnReference<{ Key: string; Type: readonly Item[] | null | undefined }>) {}

   as<const Alias extends string>(alias: Alias): DuckDBUnnestRelation<Item> {
      const relation = new DuckDBUnnest(this.source, alias);
      return new Proxy(relation, {
         get(target, property, receiver) {
            if (Reflect.has(target, property)) return Reflect.get(target, property, receiver);
            if (typeof property !== "string" || !property.startsWith("$")) return undefined;
            return Reflect.get(target.itemColumn, property);
         },
      }) as DuckDBUnnestRelation<Item>;
   }
}

export class DuckDBUnnest<Item> extends Sql {
   readonly rowAlias: string;
   readonly itemColumn: SqlTableColumnReference<{ Key: string; Type: NonNullable<Item> }>;

   constructor(
      readonly source: SqlTableColumnReference<{ Key: string; Type: readonly Item[] | null | undefined }>,
      readonly alias: string,
   ) {
      super({ type: "DuckDBUnnest", id: alias, hashId: `${source.hashId} as ${alias}` });
      this.rowAlias = `${alias}_row`;
      this.itemColumn = newSqlTableColumn({
         columnName: alias,
         key: alias,
         tableInfo: { name: this.rowAlias, alias: this.rowAlias },
         structure: source.structure?.kind === "list" ? source.structure.value : null,
      });
   }

   write(context: SqlBuildContext, options?: SqlBuildOptions | null): void {
      context.addStrings("lateral unnest(");
      this.source.raw.build(context, options);
      context.addStrings(") as ");
      context.addQuotes(this.rowAlias);
      context.addStrings("(");
      context.addQuotes(this.alias);
      context.addStrings(")");
   }
}

export function unnest<Key extends string, Item>(
   source: SqlTableColumnReference<{ Key: Key; Type: readonly Item[] | null | undefined }>,
): DuckDBUnnestBuilder<Item> {
   return new DuckDBUnnestBuilder(source);
}
