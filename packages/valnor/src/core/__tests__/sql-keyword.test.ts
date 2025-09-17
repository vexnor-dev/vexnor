import { describe, expect, test } from "vitest";
import { parseSqlKeywords } from "../sql-keyword.js";

describe("SqlKeyword parseSqlKeywords()", () => {
   test(`"select * from(select a, min(b) from test group by a)"`, ({ task }) => {
      const tokens = parseSqlKeywords(task.name);
      expect(tokens).toEqual(["select", "from", "select", "fn", "from", "group by"]);
   });

   test(`"insert into test (test_id, status) values (1, 'active')"`, ({ task }) => {
      const tokens = parseSqlKeywords(task.name);
      expect(tokens).toEqual(["insert into"]); // values is not detected due to table context
   });

   // Edge case tests
   test(`"select from where"`, ({ task }) => {
      const tokens = parseSqlKeywords(task.name);
      expect(tokens).toEqual(["select", "from", "where"]);
   });

   test(`"create table if not exists users (id int)"`, ({ task }) => {
      const tokens = parseSqlKeywords(task.name);
      expect(tokens).toEqual(["create table", "if not exists", "fn"]); // users( treated as function due to table context
   });

   test(`"select case when x > 0 then 'positive' end from table"`, ({ task }) => {
      const tokens = parseSqlKeywords(task.name);
      expect(tokens).toEqual(["select", "case", "when", "then", "end", "from"]); // case keywords are detected
   });

   test(`"select func() from table"`, ({ task }) => {
      const tokens = parseSqlKeywords(task.name);
      expect(tokens).toEqual(["select", "fn", "from"]);
   });

   test(`"update table set col = func(val) where id = 1"`, ({ task }) => {
      const tokens = parseSqlKeywords(task.name);
      expect(tokens).toEqual(["update", "set", "fn", "where"]);
   });

   test(`"create table users(id int, name varchar(255))"`, ({ task }) => {
      const tokens = parseSqlKeywords(task.name);
      expect(tokens).toEqual(["create table"]);
   });

   test(`"select * from (select id from users) as subquery"`, ({ task }) => {
      const tokens = parseSqlKeywords(task.name);
      expect(tokens).toEqual(["select", "from", "select", "from", "as"]);
   });

   test(`"with cte as (select * from table) select * from cte"`, ({ task }) => {
      const tokens = parseSqlKeywords(task.name);
      expect(tokens).toEqual(["with", "select", "from", "select", "from"]);
   });

   test(`"select order from group"`, ({ task }) => {
      const tokens = parseSqlKeywords(task.name);
      expect(tokens).toEqual(["select", "from"]);
   });

   test(`""`, ({ task }) => {
      const tokens = parseSqlKeywords(task.name);
      expect(tokens).toEqual([]);
   });

   test(`"SELECT FROM WHERE"`, ({ task }) => {
      const tokens = parseSqlKeywords(task.name);
      expect(tokens).toEqual(["select", "from", "where"]);
   });

   test(`"select * from table where col in (select id from other)"`, ({ task }) => {
      const tokens = parseSqlKeywords(task.name);
      expect(tokens).toEqual(["select", "from", "where", "select", "from"]);
   });

   test(`"select * from table where exists (select 1 from other)"`, ({ task }) => {
      const tokens = parseSqlKeywords(task.name);
      expect(tokens).toEqual(["select", "from", "where", "fn", "select", "from"]);
   });

   test(`"select col as (case when x > 0 then 'pos' else 'neg' end)"`, ({ task }) => {
      const tokens = parseSqlKeywords(task.name);
      expect(tokens).toEqual(["select", "case", "when", "then", "else", "end"]); // case keywords are detected
   });

   test(`"insert into table select * from other"`, ({ task }) => {
      const tokens = parseSqlKeywords(task.name);
      expect(tokens).toEqual(["insert into", "select", "from"]);
   });

   test(`"select * from table1 join table2 on table1.id = table2.id"`, ({ task }) => {
      const tokens = parseSqlKeywords(task.name);
      expect(tokens).toEqual(["select", "from", "join", "on"]);
   });

   // Advanced SQL syntax edge cases across different engines
   test(`"select * from table where col not in (1, 2, 3)"`, ({ task }) => {
      const tokens = parseSqlKeywords(task.name);
      expect(tokens).toEqual(["select", "from", "where", "not"]); // 'not' is detected, 'in' is not due to non-function keyword list
   });

   test(`"select * from table where not exists (select 1 from other)"`, ({ task }) => {
      const tokens = parseSqlKeywords(task.name);
      expect(tokens).toEqual(["select", "from", "where", "not", "fn", "select", "from"]); // 'exists' is not detected due to non-function keyword list
   });

   test(`"select row_number() over (partition by col order by date) from table"`, ({ task }) => {
      const tokens = parseSqlKeywords(task.name);
      expect(tokens).toEqual(["select", "fn", "partition by", "order by", "from"]); // window function keywords detected
   });

   test(`"select * from table1 left join table2 using (id)"`, ({ task }) => {
      const tokens = parseSqlKeywords(task.name);
      expect(tokens).toEqual(["select", "from", "join"]); // multi-word join detected, using not detected due to parentheses
   });

   test(`"merge into target using source on (target.id = source.id)"`, ({ task }) => {
      const tokens = parseSqlKeywords(task.name);
      expect(tokens).toEqual(["merge into", "using", "on"]); // merge into is detected
   });

   test(`"select * from table for update"`, ({ task }) => {
      const tokens = parseSqlKeywords(task.name);
      expect(tokens).toEqual(["select", "from", "for", "update"]); // both keywords detected
   });

   test(`"select cast(col as varchar(255)) from table"`, ({ task }) => {
      const tokens = parseSqlKeywords(task.name);
      expect(tokens).toEqual(["select", "cast", "as", "fn", "from"]); // cast is detected as keyword, not function
   });

   test(`"select case when col > 0 then 'positive' when col < 0 then 'negative' else 'zero' end"`, ({ task }) => {
      const tokens = parseSqlKeywords(task.name);
      expect(tokens).toEqual(["select", "case", "when", "then", "when", "then", "else", "end"]); // all case keywords detected
   });

   test(`"select * from table where col between 1 and 10"`, ({ task }) => {
      const tokens = parseSqlKeywords(task.name);
      expect(tokens).toEqual(["select", "from", "where", "between", "and"]); // between and and keywords detected
   });

   test(`"select * from table where col like '%pattern%'"`, ({ task }) => {
      const tokens = parseSqlKeywords(task.name);
      expect(tokens).toEqual(["select", "from", "where", "like"]); // like keyword detected
   });

   test(`"select * from table where col is null"`, ({ task }) => {
      const tokens = parseSqlKeywords(task.name);
      expect(tokens).toEqual(["select", "from", "where", "is", "null"]); // is null keywords detected
   });

   test(`"select * from table where col is not null"`, ({ task }) => {
      const tokens = parseSqlKeywords(task.name);
      expect(tokens).toEqual(["select", "from", "where", "is", "not", "null"]); // is not null keywords detected
   });

   test(`"select distinct col from table"`, ({ task }) => {
      const tokens = parseSqlKeywords(task.name);
      expect(tokens).toEqual(["select", "distinct", "from"]); // distinct keyword detected
   });

   test(`"select top 10 * from table"`, ({ task }) => {
      const tokens = parseSqlKeywords(task.name);
      expect(tokens).toEqual(["select", "top", "from"]); // top keyword detected
   });

   test(`"select * from table limit 10 offset 5"`, ({ task }) => {
      const tokens = parseSqlKeywords(task.name);
      expect(tokens).toEqual(["select", "from", "limit", "offset"]); // limit offset keywords detected
   });

   test(`"select * from table union select * from other"`, ({ task }) => {
      const tokens = parseSqlKeywords(task.name);
      expect(tokens).toEqual(["select", "from", "union", "select", "from"]); // union keyword detected
   });

   test(`"select * from table union all select * from other"`, ({ task }) => {
      const tokens = parseSqlKeywords(task.name);
      expect(tokens).toEqual(["select", "from", "union all", "select", "from"]); // union all multi-word keyword detected
   });

   test(`"select * from table intersect select * from other"`, ({ task }) => {
      const tokens = parseSqlKeywords(task.name);
      expect(tokens).toEqual(["select", "from", "intersect", "select", "from"]); // intersect keyword detected
   });

   test(`"select * from table except select * from other"`, ({ task }) => {
      const tokens = parseSqlKeywords(task.name);
      expect(tokens).toEqual(["select", "from", "except", "select", "from"]); // except keyword detected
   });

   test(`"create or replace view myview as select * from table"`, ({ task }) => {
      const tokens = parseSqlKeywords(task.name);
      expect(tokens).toEqual(["create or replace view", "as", "select", "from"]); // longer multi-word keyword takes precedence
   });

   test(`"create temporary table temp_table (id int)"`, ({ task }) => {
      const tokens = parseSqlKeywords(task.name);
      expect(tokens).toEqual(["temporary", "fn"]); // temp_table( treated as function
   });

   test(`"create unique index idx_name on table (col)"`, ({ task }) => {
      const tokens = parseSqlKeywords(task.name);
      expect(tokens).toEqual(["unique", "on", "fn"]); // table( treated as function
   });

   test(`"alter table users add column email varchar(255)"`, ({ task }) => {
      const tokens = parseSqlKeywords(task.name);
      expect(tokens).toEqual(["alter table", "add", "column", "fn"]); // all keywords detected
   });

   test(`"alter table users drop column email"`, ({ task }) => {
      const tokens = parseSqlKeywords(task.name);
      expect(tokens).toEqual(["alter table", "drop", "column"]); // all keywords detected
   });

   test(`"create procedure proc_name() begin select 1; end"`, ({ task }) => {
      const tokens = parseSqlKeywords(task.name);
      expect(tokens).toEqual(["fn", "begin", "select", "end"]); // procedure treated as function, other keywords detected
   });

   test(`"call stored_proc(param1, param2)"`, ({ task }) => {
      const tokens = parseSqlKeywords(task.name);
      expect(tokens).toEqual(["fn"]);
   });

   test(`"select * from table where col ~ 'regex_pattern'"`, ({ task }) => {
      const tokens = parseSqlKeywords(task.name);
      expect(tokens).toEqual(["select", "from", "where"]);
   });

   test(`"select * from table where col @> '{"key": "value"}'"`, ({ task }) => {
      const tokens = parseSqlKeywords(task.name);
      expect(tokens).toEqual(["select", "from", "where"]);
   });

   test(`"select * from table where col::jsonb ? 'key'"`, ({ task }) => {
      const tokens = parseSqlKeywords(task.name);
      expect(tokens).toEqual(["select", "from", "where"]);
   });

   test(`"select * from table tablesample system (10)"`, ({ task }) => {
      const tokens = parseSqlKeywords(task.name);
      expect(tokens).toEqual(["select", "from", "tablesample", "system"]); // tablesample keywords detected
   });

   test(`"select * from lateral (select * from other) as sub"`, ({ task }) => {
      const tokens = parseSqlKeywords(task.name);
      expect(tokens).toEqual(["select", "from", "lateral", "select", "from", "as"]); // lateral keyword detected
   });

   test(`"select * from unnest(array[1,2,3]) as t(col)"`, ({ task }) => {
      const tokens = parseSqlKeywords(task.name);
      expect(tokens).toEqual(["select", "from", "fn", "as", "fn"]); // unnest detected as keyword
   });

   test(`"select * from generate_series(1, 10) as t(n)"`, ({ task }) => {
      const tokens = parseSqlKeywords(task.name);
      expect(tokens).toEqual(["select", "from", "fn", "as", "fn"]); // generate_series detected as keyword
   });

   test(`"select * from table cross join lateral func(table.col)"`, ({ task }) => {
      const tokens = parseSqlKeywords(task.name);
      expect(tokens).toEqual(["select", "from", "join", "lateral", "fn"]); // cross join and lateral detected
   });

   test(`"select * from table pivot (sum(amount) for month in ('jan', 'feb'))"`, ({ task }) => {
      const tokens = parseSqlKeywords(task.name);
      expect(tokens).toEqual(["select", "from", "fn", "for"]); // pivot treated as function, for detected, in not detected due to non-function list
   });

   test(`"select * from (values (1, 'a'), (2, 'b')) as t(id, name)"`, ({ task }) => {
      const tokens = parseSqlKeywords(task.name);
      expect(tokens).toEqual(["select", "from", "fn", "as", "fn"]); // values treated as function due to parentheses
   });

   test(`"upsert into table (id, name) values (1, 'test') on conflict (id) do update set name = excluded.name"`, ({
      task,
   }) => {
      const tokens = parseSqlKeywords(task.name);
      expect(tokens).toEqual(["upsert into", "on conflict", "do update", "set", "excluded"]); // values( not detected due to non-function keyword pattern
   });

   test(`"insert into table (id, name) values (1, 'test') on duplicate key update name = values(name)"`, ({ task }) => {
      const tokens = parseSqlKeywords(task.name);
      expect(tokens).toEqual(["insert into", "on duplicate key", "update"]); // MySQL upsert syntax detected
   });

   // JSON and Document Database Edge Cases
   test(`"select data->'$.path' from table where data @> '{"key": "value"}'"`, ({ task }) => {
      const tokens = parseSqlKeywords(task.name);
      expect(tokens).toEqual(["select", "from", "where"]);
   });

   test(`"select json_extract(data, '$.path') from table"`, ({ task }) => {
      const tokens = parseSqlKeywords(task.name);
      expect(tokens).toEqual(["select", "fn", "from"]);
   });

   test(`"select * from table where json_contains(data, '{"key": "value"}')"`, ({ task }) => {
      const tokens = parseSqlKeywords(task.name);
      expect(tokens).toEqual(["select", "from", "where", "fn"]);
   });

   // Array Operations Edge Cases
   test(`"select array[1,2,3] from table where col = any(array[1,2,3])"`, ({ task }) => {
      const tokens = parseSqlKeywords(task.name);
      expect(tokens).toEqual(["select", "fn", "from", "where", "fn"]);
   });

   test(`"select list_value(1,2,3) from table"`, ({ task }) => {
      const tokens = parseSqlKeywords(task.name);
      expect(tokens).toEqual(["select", "fn", "from"]);
   });

   // NoSQL-style Syntax Edge Cases
   test(`"select * from c where array_contains(c.tags, 'sql')"`, ({ task }) => {
      const tokens = parseSqlKeywords(task.name);
      expect(tokens).toEqual(["select", "from", "where", "fn"]);
   });

   test(`"select value c.name from c"`, ({ task }) => {
      const tokens = parseSqlKeywords(task.name);
      expect(tokens).toEqual(["select", "from"]);
   });

   test(`"select * from table where contains(attribute, 'value')"`, ({ task }) => {
      const tokens = parseSqlKeywords(task.name);
      expect(tokens).toEqual(["select", "from", "where", "fn"]);
   });

   // Time Series and Analytics Edge Cases
   test(`"select time_bucket('1 hour', time) from metrics"`, ({ task }) => {
      const tokens = parseSqlKeywords(task.name);
      expect(tokens).toEqual(["select", "fn", "from"]);
   });

   test(`"select * from table where time > now() - interval '1 hour'"`, ({ task }) => {
      const tokens = parseSqlKeywords(task.name);
      expect(tokens).toEqual(["select", "from", "where", "fn"]);
   });

   // Advanced SQL Features Edge Cases
   test(`"with recursive cte(n) as (select 1 union all select n+1 from cte where n < 10) select * from cte"`, ({
      task,
   }) => {
      const tokens = parseSqlKeywords(task.name);
      expect(tokens).toEqual(["with", "recursive", "select", "union all", "select", "from", "where", "select", "from"]);
   });

   test(`"select * from table for system_time as of '2023-01-01'"`, ({ task }) => {
      const tokens = parseSqlKeywords(task.name);
      expect(tokens).toEqual(["select", "from", "for", "as"]);
   });

   // Window Functions with Complex Syntax
   test(`"select row_number() over (partition by dept order by salary rows between unbounded preceding and current row) from employees"`, ({
      task,
   }) => {
      const tokens = parseSqlKeywords(task.name);
      expect(tokens).toEqual(["select", "fn", "partition by", "order by", "from"]);
   });

   // Database-Specific Extensions
   test(`"select * from table where match(content) against('search term' in boolean mode)"`, ({ task }) => {
      const tokens = parseSqlKeywords(task.name);
      expect(tokens).toEqual(["select", "from", "where", "fn", "fn", "in"]);
   });

   test(`"select * from table where freetext(content, 'search term')"`, ({ task }) => {
      const tokens = parseSqlKeywords(task.name);
      expect(tokens).toEqual(["select", "from", "where", "fn"]);
   });

   // Complex Nested Expressions
   test(`"select case when exists(select 1 from other where other.id = table.id) then 'exists' else 'not exists' end from table"`, ({
      task,
   }) => {
      const tokens = parseSqlKeywords(task.name);
      expect(tokens).toEqual([
         "select",
         "case",
         "when",
         "fn",
         "select",
         "from",
         "where",
         "then",
         "else",
         "end",
         "from",
      ]);
   });

   // Spatial/Geographic Extensions
   test(`"select st_distance(point1, point2) from locations where st_within(point, polygon)"`, ({ task }) => {
      const tokens = parseSqlKeywords(task.name);
      expect(tokens).toEqual(["select", "fn", "from", "where", "fn"]);
   });
});
