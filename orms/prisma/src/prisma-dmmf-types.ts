export type PrismaField = {
   name: string;
   kind: "scalar" | "object" | "enum" | string;
   isId?: boolean;
   dbName?: string | null;
};

export type PrismaPrimaryKey = {
   fields: readonly string[];
};

export type PrismaModel = {
   name: string;
   dbName?: string | null;
   schema?: string | null;
   fields: readonly PrismaField[];
   primaryKey?: PrismaPrimaryKey | null;
};

export type PrismaDatamodel = {
   models: readonly PrismaModel[];
};
