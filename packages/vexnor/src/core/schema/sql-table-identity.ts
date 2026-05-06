export type SqlTableIdentity = { schema?: string | null; name: string; alias?: string | null; out?: boolean };

export function getTableId({ schema, name, alias }: Pick<SqlTableIdentity, "schema" | "name" | "alias">): string {
   return `${schema ?? "-"}.${alias ?? name}`;
}
