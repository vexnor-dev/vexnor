# CI/CD Integration

Valnor integrates into your CI/CD pipeline to ensure type safety and SQL query validation against your latest database schema.
This integration helps catch potential database-related issues early in the development cycle.

Please check `CI (GitHub)` workflow in this repository for a CI/CD example:
> https://github.com/atopala/valnor/actions/workflows/ci_github.yml
* Spin off a Postgres container for use during CI/CD
* Execute db migrations against the Postgres instance
* Re-generate mapping code with `Valnor` and build 
* Run automated testing using the re-generated code against the newly provisioned Postgres instance

## Benefits

* Automatic type generation during build process
* Early detection of SQL query incompatibilities
* Validation against the latest database schema
* Prevention of runtime errors due to schema mismatches
* Consistent type definitions across development and production environments