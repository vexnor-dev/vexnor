export type SqlTableCrudConfig<
   T extends {
      Select: Record<string, unknown>;
      Insert?: Record<string, unknown>;
      Update?: Record<string, unknown>;
      Delete?: boolean;
   },
> = {
   read: true;
   create: T extends { Select: Record<string, unknown>; Insert: Record<string, unknown> } ? true : false;
   update: T extends { Select: Record<string, unknown>; Update: Record<string, unknown> } ? true : false;
   delete?: T extends { Delete: true } ? true : false;
};
