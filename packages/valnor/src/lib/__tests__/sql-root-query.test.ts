import { describe, expect, test } from "vitest";
import { Users } from "./types/index.js";
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
      >`select ${Users.name}, min(${Users.age}), ${Users.city.$$fmt("table.column")} user_city, ${Users.createdAt}
        from ${Users}
        where ${Users.city} = ${param("city")}
          and ${Users.name} in (${param("names")})
        group by ${Users.age}`;
      expect(query.values({ names, city: "Munich" })).toEqual(["Munich", "One", "Two", "Three"]);
      // check 'Users' model for static alias "users_1"
      expect(trim(query.sql({ names, city: "Munich" }))).toBe(
         trim(
            `select "users_1"."name",
                    min("users_1"."age"),
                    "users_1"."city"       user_city,
                    "users_1"."created_at" as "createdAt"
             from "public"."users" as "users_1"
             where "users_1"."city" = ?
               and "users_1"."name" in (?, ?, ?)
             group by "users_1"."age"`,
         ),
      );

      expect(trim(query.text({ names, city: "Munich" }))).toBe(
         trim(
            `select "users_1"."name",
                    min("users_1"."age"),
                    "users_1"."city" user_city,
                    "users_1"."created_at" as "createdAt"
             from "public"."users" as "users_1"
             where "users_1"."city" = $1
               and "users_1"."name" in ($2, $3, $4)
             group by "users_1"."age"`,
         ),
      );
   });
});
