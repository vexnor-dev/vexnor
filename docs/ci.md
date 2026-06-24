# CI / Deployment

How to set up CI for a cross-stack vexnor project — building, testing, and deploying TypeScript + .NET in a single pipeline.

## Pipeline Overview

A cross-stack CI pipeline runs these stages in order:

```
Install → Build TypeScript → Serialize manifests → Run Node.js tests
                                                  → Build .NET → Run .NET tests
                                                  → Upload coverage
```

The .NET build depends on serialized manifests being present. Node.js tests and .NET tests can run in parallel once manifests exist.

## GitHub Actions Example

Based on the actual vexnor CI workflow:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: ['**']

jobs:
  build-and-test:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: postgres
        ports: ['5432:5432']
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    env:
      POSTGRES_HOST: localhost
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DATABASE: postgres
      POSTGRES_PORT: 5432

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '22'

      - uses: pnpm/action-setup@v4
        with:
          run_install: false

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Migrate databases
        run: pnpm db-migrate:postgres

      - name: Build TypeScript
        run: pnpm build

      - name: Serialize manifests
        run: |
          npx vexnor serialize \
            -i "src/queries/**/*.ts" \
            -o manifests/ \
            -d postgresql

      - name: Regenerate cross-runtime fixtures
        run: npx tsx generate-cross-runtime.ts
        working-directory: stacks/fixtures

      - name: Run Node.js tests
        run: pnpm test

      - uses: actions/setup-dotnet@v4
        with:
          dotnet-version: '10.0.x'

      - name: Build .NET
        run: dotnet build stacks/dotnet --nologo

      - name: Run .NET tests
        run: dotnet test stacks/dotnet --nologo --no-build
        env:
          ConnectionStrings__Postgres: "Host=localhost;Port=5432;Database=postgres;Username=postgres;Password=postgres"
```

## Key Design Decisions

### Manifests: commit or generate in CI?

**Option A — Commit manifests to the repo** (recommended for most teams):

- Manifests are versioned alongside source code
- CI only needs to verify they're up to date (build + test)
- Simpler pipeline — no serialize step needed in CI
- PRs show manifest diffs for review

Add a CI check that manifests are fresh:

```yaml
- name: Verify manifests are up to date
  run: |
    npx vexnor serialize -i "src/queries/**/*.ts" -o manifests/ -d postgresql
    git diff --exit-code manifests/
```

**Option B — Generate manifests in CI** (for strict reproducibility):

- Manifests never committed — always derived from source
- CI serialize step is required
- .gitignore includes `manifests/`

### Fixture freshness check

Same pattern — verify fixtures match source:

```yaml
- name: Verify cross-runtime fixtures
  run: |
    cd stacks/fixtures && npx tsx generate-cross-runtime.ts
    git diff --exit-code stacks/fixtures/manifests/
```

## Multi-Database CI

If your project targets multiple databases, add services for each:

```yaml
services:
  postgres:
    image: postgres:15
    # ...
  mssql:
    image: mcr.microsoft.com/mssql/server:2022-latest
    env:
      ACCEPT_EULA: Y
      MSSQL_SA_PASSWORD: P@ssw0rd!
    ports: ['1433:1433']
    options: >-
      --health-cmd "/opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P 'P@ssw0rd!' -C -Q 'SELECT 1'"
      --health-interval 10s
      --health-timeout 5s
      --health-retries 10
```

And serialize for each dialect:

```yaml
- name: Serialize manifests (all dialects)
  run: |
    npx vexnor serialize -i "src/queries/**/*.ts" -o manifests/postgres/ -d postgresql
    npx vexnor serialize -i "src/queries/**/*.ts" -o manifests/mssql/ -d transactsql
```

## Coverage

Upload coverage from both runtimes to a single dashboard:

```yaml
- name: Run Node.js tests with coverage
  run: pnpm test  # vitest --coverage

- name: Run .NET tests with coverage
  run: |
    dotnet test stacks/dotnet \
      --collect:"XPlat Code Coverage" \
      --results-directory stacks/dotnet/TestResults

- name: Upload to Codecov
  uses: codecov/codecov-action@v5
  with:
    token: ${{ secrets.CODECOV_TOKEN }}
    files: |
      coverage/clover.xml
      stacks/dotnet/TestResults/**/coverage.cobertura.xml
    flags: nodejs,dotnet
```

## Deployment

### Deploying the TypeScript service

Standard Node.js deployment — manifests are bundled with the service if it also runs .NET queries locally, or served to .NET consumers via shared storage.

### Deploying the .NET service

Ensure the .NET service has access to fresh manifests:

1. **Bundled** — manifests are copied into the .NET build output (via `.csproj` `CopyToOutputDirectory`)
2. **Shared volume** — both services read from a shared filesystem or S3 bucket
3. **API** — TypeScript service exposes an endpoint that serves the manifest (less common)

The simplest approach for a monorepo is bundling:

```xml
<!-- .csproj -->
<ItemGroup>
  <None Include="../../manifests/**/*.json" CopyToOutputDirectory="PreserveNewest" LinkBase="manifests" />
</ItemGroup>
```

### Deployment order

When schema and queries change together:

1. Deploy database migration (additive — new columns/tables)
2. Deploy services with new manifests
3. (Later) Drop unused columns if needed

## Caching

Speed up CI with build caches:

```yaml
- uses: actions/cache@v4
  with:
    path: ~/.pnpm-store
    key: ${{ runner.os }}-pnpm-${{ hashFiles('**/pnpm-lock.yaml') }}

- uses: actions/cache@v4
  with:
    path: |
      packages/*/dist
      plugins/*/dist
    key: ${{ runner.os }}-build-${{ hashFiles('packages/*/src/**', 'plugins/*/src/**') }}
```

## Cross-Reference

- [Workflow](workflow.md) — local development loop
- [Cross-Stack Setup](cross-stack-setup.md) — initial project setup
- [Serialize](serialize.md) — CLI reference for manifest generation
