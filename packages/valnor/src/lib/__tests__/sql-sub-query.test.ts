import { describe, expect, test } from "vitest";
import { sql } from "../sql.js";
import { IUsersSelect, Users } from "./types/index.js";
import { info } from "../plugins/index.js";
import { param } from "../sql-param.js";
import { trim } from "./utils.js";

describe("sql subqueries tests", () => {
   test("sub-query from", () => {
      const UsersInCity = sql<IUsersSelect, { city: string }>`
         ${info({ label: "UsersInCity" })}
         select ${Users.$$all}
         from ${Users}
         where ${Users.city} = ${param("city")}`;

      const query = sql<IUsersSelect, { age: number; city: string }>`
         select ${UsersInCity.ROW.$$all}
         from (${UsersInCity})
         where ${UsersInCity.ROW.age} > ${param("age")}`;

      query.buildCache();
      expect(query.values({ age: 21, city: "Munich" })).toEqual(["Munich", 21]);
      expect(trim(query.sql({ age: 21, city: "Munich" }))).toBe(trim`select "UsersInCity".*
                                                                     from (( /* --label: UsersInCity */ select "users_1"."user_id"    as "userId",
                                                                                                               "users_1"."name",
                                                                                                               "users_1"."email",
                                                                                                               "users_1"."age",
                                                                                                               "users_1"."city",
                                                                                                               "users_1"."password",
                                                                                                               "users_1"."created_at" as "createdAt",
                                                                                                               "users_1"."updated_at" as "updatedAt"
                                                                                                        from "public"."users" as "users_1"
                                                                                                        where "users_1"."city" = ?) as "UsersInCity")
                                                                     where "UsersInCity"."age" > ?`);
   });

   test("sub-query join", () => {
      const UsersInCity = sql<IUsersSelect, { city: string }>`
         ${info({ label: "UsersInCity" })}
         select ${Users.$$all}
         from ${Users}
         where ${Users.city} = ${param("city")}
      `;

      const query = sql<IUsersSelect, { age: number; city: string }>`select ${Users.$$all}
                                                                     from ${Users}
                                                                             join (${UsersInCity}) on ${Users.userId} = ${UsersInCity.ROW.userId}
                                                                     where ${Users.age} > ${param("age")}`;

      expect(query.values({ age: 21, city: "Munich" })).toEqual(["Munich", 21]);
      expect(trim(query.sql({ age: 21, city: "Munich" }))).toBe(trim`select "users_1"."user_id" as "userId",
                                                                            "users_1"."name",
                                                                            "users_1"."email",
                                                                            "users_1"."age",
                                                                            "users_1"."city",
                                                                            "users_1"."password",
                                                                            "users_1"."created_at" as "createdAt",
                                                                            "users_1"."updated_at" as "updatedAt"
                                                                     from "public"."users" as "users_1"
                                                                             join ((
                                                                        /* --label: UsersInCity */
                                                                        select "users_1"."user_id"  as  "userId",
                                                                               "users_1"."name",
                                                                               "users_1"."email",
                                                                               "users_1"."age",
                                                                               "users_1"."city",
                                                                               "users_1"."password",
                                                                               "users_1"."created_at" as "createdAt",
                                                                               "users_1"."updated_at" as "updatedAt"
                                                                        from "public"."users" as "users_1"
                                                                        where "users_1"."city" = ?) as "UsersInCity")
                                                                     on "users_1"."user_id" = "UsersInCity"."userId"
                                                                     where "users_1"."age" > ?`);
   });
});
