import { assertType, describe, test } from "vitest";
import { sql } from "#/core/sql.js";
import { when } from "#/core/operators/sql-when.js";
import { param } from "#/core/query/sql-param.js";
import { row } from "#/core/query/sql-select-row.js";
import { ParamsOf } from "#/core/sql-base.js";
import { Account } from "@test-models/vexnor_dev.schema.js";

type P = { dateStart: Date | null; dateEnd: Date | null };

describe("when<P>() explicit type arg — ParamsOf inference", () => {
   test("when<P>() with explicit type — ParamsOf includes flag + branch params", () => {
      const query = sql`
         SELECT ${row(Account.$$)} FROM ${Account}
         WHERE true
         ${when<P>("dateStart", sql`AND ${Account.$createdAt} >= ${param<P>("dateStart")}`)}
         ${when<P>("dateEnd", sql`AND ${Account.$createdAt} <= ${param<P>("dateEnd")}`)}
      `;
      type Result = ParamsOf<typeof query>;
      assertType<Result>({ dateStart: new Date(), dateEnd: new Date() });
   });

   test("when<P>() single — ParamsOf resolves to the explicit params type", () => {
      const query = sql`
         SELECT ${row(Account.$$)} FROM ${Account}
         WHERE true
         ${when<P>("dateStart", sql`AND ${Account.$createdAt} >= ${param<P>("dateStart")}`)}
      `;
      type Result = ParamsOf<typeof query>;
      assertType<Result>({ dateStart: new Date(), dateEnd: new Date() });
   });

   test("when<P>() rejects empty params", () => {
      const query = sql`
         SELECT ${row(Account.$$)} FROM ${Account}
         WHERE true
         ${when<P>("dateStart", sql`AND ${Account.$createdAt} >= ${param<P>("dateStart")}`)}
      `;
      type Result = ParamsOf<typeof query>;
      // @ts-expect-error — empty object is not valid
      assertType<Result>({});
   });

   test("when<P>() with no-param branch (static SQL) — flag is sole param", () => {
      type Flags = { includeActive: boolean };
      const query = sql`
         SELECT ${row(Account.$$)} FROM ${Account}
         WHERE true
         ${when<Flags>("includeActive", sql`AND ${Account.$status} = 'active'`)}
      `;
      type Result = ParamsOf<typeof query>;
      assertType<Result>({ includeActive: true });
   });

   test("when<P>() with no-param branch rejects empty", () => {
      type Flags = { includeActive: boolean };
      const query = sql`
         SELECT ${row(Account.$$)} FROM ${Account}
         WHERE true
         ${when<Flags>("includeActive", sql`AND ${Account.$status} = 'active'`)}
      `;
      type Result = ParamsOf<typeof query>;
      // @ts-expect-error — empty object missing the flag
      assertType<Result>({});
   });

   test("when() without explicit type (workaround) — still works", () => {
      const query = sql`
         SELECT ${row(Account.$$)} FROM ${Account}
         WHERE true
         ${when("dateStart", sql`AND ${Account.$createdAt} >= ${param<P>("dateStart")}`)}
         ${when("dateEnd", sql`AND ${Account.$createdAt} <= ${param<P>("dateEnd")}`)}
      `;
      type Result = ParamsOf<typeof query>;
      assertType<Result>({ dateStart: new Date(), dateEnd: new Date() });
   });
});
