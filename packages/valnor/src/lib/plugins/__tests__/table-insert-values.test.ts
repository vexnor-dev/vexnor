import { describe, expect, test } from "vitest";
import { sql } from "../../sql.js";
import { IUsersSelect, Users } from "../../__tests__/types/index.js";
import { trim } from "../../__tests__/utils.js";

describe("sql plugin table.$$values() tests", () => {
   test("sql() insert with $values()", () => {
      const query = sql<IUsersSelect>`
         insert into ${Users} ${Users.$$values({
            name: "Bob",
            age: 24,
            email: "bob@example.com",
            city: "Munich",
            password: "test1234",
         })}
            returning ${Users.$$all}`;

      expect(query.values()).toEqual(["Bob", "bob@example.com", 24, "Munich", "test1234"]);
      expect(trim(query.sql())).toBe(
         trim(
            `insert into "public"."users" as "users_1" ("user_id", "name", "email", "age", "city", "password",
                                                        "created_at",
                                                        "updated_at")
             values (default, ?, ?, ?, ?, ?, default, default)
             returning "users_1"."user_id" as "userId", "users_1"."name", "users_1"."email", "users_1"."age", "users_1"."city", "users_1"."password", "users_1"."created_at" as "createdAt", "users_1"."updated_at" as "updatedAt"`,
         ),
      );
   });
});
