import { SqlTableCreateOptional } from "./sql-table-create.js";
import { SqlTableReadOptional } from "./sql-table-read.js";
import { SqlTableUpdateOptional } from "./sql-table-update.js";
import { SqlTableDeleteOptional } from "./sql-table-delete.js";

export type SqlTableCrud<T> = {} & SqlTableReadOptional<T> &
   SqlTableCreateOptional<T> &
   SqlTableUpdateOptional<T> &
   SqlTableDeleteOptional<T>;
