import { describe, expect, test } from "vitest";
import { IUsersSelect, Users } from "./types/index.js";
import { trim } from "./utils.js";
import { sql } from "../sql.js";
import { param } from "../sql-param.js";

describe("sql() tests", () => {
   test("sql() select", () => {
      const names = ["One", "Two", "Three"];
      type Row = {
         name: string;
         age: number;
         user_city: string;
         createdAt: Date;
      };
      const query = sql<
         Row,
         { names: string[]; city: string }
      >`select ${Users.name}, min(${Users.age}), ${Users.city.$("table.name")} user_city, ${Users.createdAt}
        from ${Users}
        where ${Users.city} = ${param("city")}
          and ${Users.name} in (${param("names")})
        group by ${Users.age}`;
      expect(query.getValues({ names, city: "Munich" })).toEqual(["Munich", "One", "Two", "Three"]);
      // check 'Users' model for static alias "users_1"
      expect(trim(query.getSql({ names, city: "Munich" }))).toBe(
         trim(
            `select "users_1"."name",
                    min("users_1"."age"),
                    "users_1"."city"       user_city,
                    "users_1"."created_at" "createdAt"
             from "public"."users" "users_1"
             where "users_1"."city" = ?
               and "users_1"."name" in (?, ?, ?)
             group by "users_1"."age"`,
         ),
      );

      expect(trim(query.getText({ names, city: "Munich" }))).toBe(
         trim(
            `select "users_1"."name",
                    min("users_1"."age"),
                    "users_1"."city"       user_city,
                    "users_1"."created_at" "createdAt"
             from "public"."users" "users_1"
             where "users_1"."city" = $1
               and "users_1"."name" in ($2, $3, $4)
             group by "users_1"."age"`,
         ),
      );
   });

   test("sql() insert with $values()", () => {
      const query = sql<IUsersSelect>`
         insert into ${Users} ${Users.$values({
            name: "Bob",
            age: 24,
            email: "bob@example.com",
            city: "Munich",
            password: "test1234",
         })}
            returning ${Users.$all}`;

      expect(query.getValues()).toEqual(["Bob", "bob@example.com", 24, "Munich", "test1234"]);
      expect(trim(query.getSql())).toBe(
         trim(
            `insert into "public"."users" ("user_id", "name", "email", "age", "city", "password", "created_at",
                                           "updated_at")
             values (default, ?, ?, ?, ?, ?, default, default)
             returning "user_id" "userId", "name", "email", "age", "city", "password", "created_at" "createdAt", "updated_at" "updatedAt"`,
         ),
      );
   });

   test("sql() update with $set()", () => {
      const updatedAt = new Date();
      const query = sql<IUsersSelect, { userId: number }>`
         update ${Users}
         set ${Users.$set({
            name: "Bob",
            age: 24,
            email: "bob@example.com",
            city: "Munich",
            password: "test1234",
            updatedAt,
         })}
         where ${Users.userId} = ${param("userId")}
         returning ${Users.$all}`;
      expect(query.getValues({ userId: 101 })).toEqual([
         "Bob",
         "bob@example.com",
         24,
         "Munich",
         "test1234",
         updatedAt,
         101,
      ]);
      expect(trim(query.getSql({ userId: 101 }))).toBe(
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

   test("sub-query from", () => {
      const UsersInCity = sql<IUsersSelect, { city: string }>`select ${Users.$all}
                                                              from ${Users}
                                                              where ${Users.city} = ${param("city")}`;

      const query = sql<IUsersSelect, { age: number; city: string }>`
         select ${UsersInCity.$all}
         from (${UsersInCity})
         where ${UsersInCity.ROW.age} > ${param("age")} )`;

      query.getBuild();
      expect(query.getValues({ age: 21, city: "Munich" })).toEqual(["Munich", 21]);
      expect(trim(query.getSql({ age: 21, city: "Munich" }))).toBe(trim`select "users_1_query".*
                                                                        from ((select "users_1"."user_id"    "userId",
                                                                                      "users_1"."name",
                                                                                      "users_1"."email",
                                                                                      "users_1"."age",
                                                                                      "users_1"."city",
                                                                                      "users_1"."password",
                                                                                      "users_1"."created_at" "createdAt",
                                                                                      "users_1"."updated_at" "updatedAt"
                                                                               from "public"."users" "users_1"
                                                                               where "users_1"."city" = ?) "users_1_query")
                                                                        where "users_1_query"."age" > ?`);
   });

   test("sub-query join", () => {
      const UsersInCity = sql<IUsersSelect, { city: string }>`select ${Users.$all}
                                                              from ${Users}
                                                              where ${Users.city} = ${param("city")}
      `;

      const query = sql<IUsersSelect, { age: number; city: string }>`select ${Users.$all}
                                                                     from ${Users}
                                                                             join (${UsersInCity}) on ${Users.userId} = ${UsersInCity.ROW.userId}
                                                                     where ${Users.age} > ${param("age")} )`;

      expect(query.getValues({ age: 21, city: "Munich" })).toEqual(["Munich", 21]);
      expect(trim(query.getSql({ age: 21, city: "Munich" }))).toBe(trim`select "users_1"."user_id"    "userId",
                                                                               "users_1"."name",
                                                                               "users_1"."email",
                                                                               "users_1"."age",
                                                                               "users_1"."city",
                                                                               "users_1"."password",
                                                                               "users_1"."created_at" "createdAt",
                                                                               "users_1"."updated_at" "updatedAt"
                                                                        from "public"."users" "users_1"
                                                                                join ((select "users_1"."user_id"    "userId",
                                                                                              "users_1"."name",
                                                                                              "users_1"."email",
                                                                                              "users_1"."age",
                                                                                              "users_1"."city",
                                                                                              "users_1"."password",
                                                                                              "users_1"."created_at" "createdAt",
                                                                                              "users_1"."updated_at" "updatedAt"
                                                                                       from "public"."users" "users_1"
                                                                                       where "users_1"."city" = ?) "users_1_query")
                                                                                     on "users_1"."user_id" = "users_1_query"."userId"
                                                                        where "users_1"."age" > ?`);
   });
});
