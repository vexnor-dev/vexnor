import { describe, expect, test } from "vitest";
import { sql } from "../../sql.js";
import { IUsersSelect, Users } from "../../__tests__/types/index.js";
import { param } from "../../sql-param.js";
import { trim } from "../../__tests__/utils.js";

describe("sql plugin: table.$$set tests", () => {
   test("sql() update with $set()", () => {
      const updatedAt = new Date();
      const query = sql<IUsersSelect, { userId: number }>`
         update ${Users}
         set ${Users.$$set({
            name: "Bob",
            age: 24,
            email: "bob@example.com",
            city: "Munich",
            password: "test1234",
            updatedAt,
         })}
         where ${Users.userId} = ${param("userId")}
         returning ${Users.$.all}`;
      expect(query.values({ userId: 101 })).toEqual([
         "Bob",
         "bob@example.com",
         24,
         "Munich",
         "test1234",
         updatedAt,
         101,
      ]);
      expect(trim(query.sql({ userId: 101 }))).toBe(
         trim`update "public"."users" "users_1"
              set "name"       = ?,
                  "email"      = ?,
                  "age"        = ?,
                  "city"       = ?,
                  "password"   = ?,
                  "updated_at" = ?
              where "users_1"."user_id" = ?
              returning "user_id" "userId", "name", "email", "age", "city", "password", "created_at" "createdAt", "updated_at" "updatedAt"`,
      );
   });
});
