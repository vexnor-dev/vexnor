// noinspection SqlNoDataSourceInspection,SqlResolve
import { describe, expect, test } from "vitest";
import { Account } from "@test-models/vexnor_dev.account-table.js";
import { SqlUpdateCommand } from "#src/core/crud/sql-update-command.js";
import { SqlDeleteCommand } from "#src/core/crud/sql-delete-command.js";
import { SqlInsertRowsCommand } from "#src/core/crud/sql-insert-rows-command.js";
import { SqlInsertFromCommand } from "#src/core/crud/sql-insert-from-command.js";
import { sqlUpdate } from "#src/core/crud/sql-update.js";
import { sqlDelete } from "#src/core/crud/sql-delete.js";
import { sqlInsertRows } from "#src/core/crud/sql-insert-rows.js";
import { sqlInsertFrom } from "#src/core/crud/sql-insert-from.js";
import { sql } from "#src/core/sql.js";
import { input } from "#src/core/query/sql-input.js";
import { info } from "#src/core/charms/sql-query-info.js";

const defaultOptions = { dialect: "postgresql" as const };

describe("SqlUpdateCommand.build() — parity with sqlUpdate()", () => {
   test("produces same SQL as sqlUpdate() with empty args", () => {
      const command = new SqlUpdateCommand(Account, {});
      const queryFromCommand = command.build();
      const queryFromFunction = sqlUpdate(Account, {});

      const cmdSql = queryFromCommand.getSql({ params: { set: { email: "x@y.com" } }, options: defaultOptions });
      const fnSql = queryFromFunction.getSql({ params: { set: { email: "x@y.com" } }, options: defaultOptions });

      expect(cmdSql.text).toBe(fnSql.text);
      expect(cmdSql.values).toEqual(fnSql.values);
   });

   test("produces same SQL as sqlUpdate() with WHERE", () => {
      const params = input<{ id: string }>();
      const args = { WHERE: sql`${Account.$accountId} = ${params.$id}` };

      const command = new SqlUpdateCommand(Account, args);
      const queryFromCommand = command.build();
      const queryFromFunction = sqlUpdate(Account, args);

      const cmdSql = queryFromCommand.getSql({ params: { set: { email: "x@y.com" }, id: "abc" }, options: defaultOptions });
      const fnSql = queryFromFunction.getSql({ params: { set: { email: "x@y.com" }, id: "abc" }, options: defaultOptions });

      expect(cmdSql.text).toBe(fnSql.text);
      expect(cmdSql.values).toEqual(fnSql.values);
   });

   test("produces same SQL as sqlUpdate() with info", () => {
      const command = new SqlUpdateCommand(Account, {}, info({ driver: "postgres" }));
      const queryFromCommand = command.build();
      const queryFromFunction = sqlUpdate(Account, {}, info({ driver: "postgres" }));

      const cmdSql = queryFromCommand.getSql({ params: { set: { email: "x@y.com" } }, options: defaultOptions });
      const fnSql = queryFromFunction.getSql({ params: { set: { email: "x@y.com" } }, options: defaultOptions });

      expect(cmdSql.text).toBe(fnSql.text);
      expect(cmdSql.values).toEqual(fnSql.values);
   });
});

describe("SqlDeleteCommand.build() — parity with sqlDelete()", () => {
   test("produces same SQL as sqlDelete() with force", () => {
      const command = new SqlDeleteCommand(Account, { force: true });
      const queryFromCommand = command.build();
      const queryFromFunction = sqlDelete(Account, { force: true });

      const cmdSql = queryFromCommand.getSql({ options: defaultOptions });
      const fnSql = queryFromFunction.getSql({ options: defaultOptions });

      expect(cmdSql.text).toBe(fnSql.text);
   });

   test("produces same SQL as sqlDelete() with WHERE", () => {
      const params = input<{ id: string }>();
      const args = { WHERE: sql`${Account.$accountId} = ${params.$id}` };

      const command = new SqlDeleteCommand(Account, args);
      const queryFromCommand = command.build();
      const queryFromFunction = sqlDelete(Account, args);

      const cmdSql = queryFromCommand.getSql({ params: { id: "abc" }, options: defaultOptions });
      const fnSql = queryFromFunction.getSql({ params: { id: "abc" }, options: defaultOptions });

      expect(cmdSql.text).toBe(fnSql.text);
      expect(cmdSql.values).toEqual(fnSql.values);
   });

   test("throws without WHERE or force", () => {
      expect(() => new SqlDeleteCommand(Account, {} as never)).toThrow("WHERE condition or force required");
   });
});

describe("SqlInsertRowsCommand.build() — parity with sqlInsertRows()", () => {
   test("produces same SQL as sqlInsertRows()", () => {
      const command = new SqlInsertRowsCommand(Account);
      const queryFromCommand = command.build();
      const queryFromFunction = sqlInsertRows(Account);

      const params = { rows: [{ email: "a@b.com", firstName: "A", lastName: "B", status: "CREATED" }] } as never;
      const cmdSql = queryFromCommand.getSql({ params, options: defaultOptions });
      const fnSql = queryFromFunction.getSql({ params, options: defaultOptions });

      expect(cmdSql.text).toBe(fnSql.text);
      expect(cmdSql.values).toEqual(fnSql.values);
   });

   test("produces same SQL as sqlInsertRows() with info", () => {
      const command = new SqlInsertRowsCommand(Account, info({ driver: "postgres" }));
      const queryFromCommand = command.build();
      const queryFromFunction = sqlInsertRows(Account, { field: "rows", info: info({ driver: "postgres" }) });

      const params = { rows: [{ email: "a@b.com", firstName: "A", lastName: "B", status: "CREATED" }] } as never;
      const cmdSql = queryFromCommand.getSql({ params, options: defaultOptions });
      const fnSql = queryFromFunction.getSql({ params, options: defaultOptions });

      expect(cmdSql.text).toBe(fnSql.text);
      expect(cmdSql.values).toEqual(fnSql.values);
   });
});

describe("SqlInsertFromCommand.build() — parity with sqlInsertFrom()", () => {
   test("produces same SQL as sqlInsertFrom()", () => {
      const from = sql`select ${Account.$email}, ${Account.$firstName} from ${Account}`;
      const args = { FROM: from as never };

      const command = new SqlInsertFromCommand(Account, args);
      const queryFromCommand = command.build();
      const queryFromFunction = sqlInsertFrom(Account, args);

      const cmdSql = queryFromCommand.getSql({ options: defaultOptions });
      const fnSql = queryFromFunction.getSql({ options: defaultOptions });

      expect(cmdSql.text).toBe(fnSql.text);
   });

   test("produces same SQL as sqlInsertFrom() with info", () => {
      const from = sql`select ${Account.$email}, ${Account.$firstName} from ${Account}`;
      const args = { FROM: from as never };

      const command = new SqlInsertFromCommand(Account, args, info({ driver: "postgres" }));
      const queryFromCommand = command.build();
      const queryFromFunction = sqlInsertFrom(Account, args, info({ driver: "postgres" }));

      const cmdSql = queryFromCommand.getSql({ options: defaultOptions });
      const fnSql = queryFromFunction.getSql({ options: defaultOptions });

      expect(cmdSql.text).toBe(fnSql.text);
   });

   test("throws without FROM arg", () => {
      expect(() => new SqlInsertFromCommand(Account, {} as never)).toThrow("Args 'FROM' is required");
   });
});
