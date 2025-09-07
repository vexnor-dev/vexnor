@workspace

This is the monorepo workspace for a NodeJS utility that generates type mappings from a postgres schema into typescript types.

The main Node.js utility is called "sql-typecraft" and it's a CLI tool that could be used like this:
sql-typecraft generate --schema one_sql --pascalCaseTables --camelCaseColumns --uri \$POSTGRES_URI --outDir 'src/codegen'

The generated code can be used to write type safe SQL queries using existing Node.js libraries:
- `pg`
- `mssql`
- `mysql`.

You can find examples for all SQL CRUD operations in this index.ts

The workspace include the source code for "sql-typecraft" and two examples for esm and cjs.

The readme.md file must be using the markdown syntax that I can use as comprehensive help file to describe the purpose, installation, usage and options of this utility.
Replace 


