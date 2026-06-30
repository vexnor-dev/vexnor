# Permissions

The following actions are pre-approved by the repo owner:

- **Git push** to feature branches (never to main/master directly)
- **Git force push** (`--force-with-lease`) to feature branches after rebase
- **Git rebase** feature branches onto main to resolve merge conflicts
- **Create and remove worktrees** for feature branch work
- **Create commits** with comprehensive messages after build+test pass
- **Delete dead/unused code** (unreferenced files, obsolete exports)
- **Remove deprecated APIs** when they are replaced by new implementations in the same PR
- **Modify CI workflows** (.github/workflows/) to fix broken steps
- **Update snapshots** with `--update` flag when code changes legitimately alter output
- **Rebuild packages** (`pnpm build`, `pnpm --filter ... build`) as needed
- **Regenerate cross-runtime fixtures** (`npx tsx generate-cross-runtime.ts`)
- **Run .NET build and tests** (`dotnet build`, `dotnet test`)
- **Modify coverage exclusions** in vitest.config.ts for non-library code (CLI, test infrastructure, examples)
- **Create local SQLite databases** from migration SQL files for testing (`@db-sqlite3/`)
- **Run codegen** for test projects and examples (`pnpm --filter ... run codegen`)
- **Fix code-quality review findings** (CodeQL, github-code-quality) without explicit per-issue approval
- **Add test coverage** for uncovered diff lines flagged by codecov/patch
