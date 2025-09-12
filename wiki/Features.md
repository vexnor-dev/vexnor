# Features

* Generates TypeScript types from SQL db schemas
* Supports both ESM and CommonJS modules
* Write safe SQL queries using typescript types for tables, columns, views, etc.
* Support for both `postgres` popular drivers [pg](https://www.npmjs.com/package/pg) and [postgres.js](https://www.npmjs.com/package/postgres)
* Customizable naming conventions (Pascal case for tables, camel case for columns)
* Automatic enum type generation (`postgres`)

## Snakecase vs. camelcase

Naming conventions for Postgres suggest to use **snake_case** and direct mapping contradicts **camelCase** in JavaScript/TypeScript.
Luckily both `postgres.js` and `Valnor` are capable to offer a reliant translation layer **snake_case - camelCase** to avoid compromises.

Generated mapping code will always inject **snake_case** columns into the SQL query.

> postgres.js only: Enable `camel` transformation in the `postgres.js` connection so that also returned results will be transformed into `camelCase`.