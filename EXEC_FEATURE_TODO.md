# Valnor Exec - Implementation Roadmap

## Status: 📋 Not Started

---

## Milestone 1: Core Extensions 🎯
**Goal:** Extend core SqlQuery with params property and create config helpers

**Dependencies:** None

**Tasks:**
- [ ] Add `SqlQuery.params` property to core (`src/core/sql.ts`)
  - Returns `Record<string, SqlParam>` with param metadata
  - Include name, type for each param
- [ ] Create config type definitions (`src/config/types.ts`)
  - ValnorConfig, ProfileConfig, QueryConfig interfaces
  - ConnectionConfig, ExecConfig, SqlParam types
- [ ] Implement `defineConfig()` helper (`src/config/define-config.ts`)
  - Validation for profiles, connections, generate settings
  - Return typed config object
- [ ] Implement `defineQueryConfig()` helper (`src/config/define-query-config.ts`)
  - Validation for queries, environments
  - Return typed query config object

**Testing:**
- [ ] Unit tests for `SqlQuery.params` extraction
- [ ] Unit tests for config validation

**Deliverable:** Core extensions ready for use by exec commands

---

## Milestone 2: Config System 🔧
**Goal:** Load and merge configs from multiple sources with priority resolution

**Dependencies:** Milestone 1

**Tasks:**
- [ ] Implement config file discovery (`src/cli/exec/config-loader.ts`)
  - Find root config (valnor.config.ts/mjs/js)
  - Find file-specific config ({filename}.valnor.ts)
- [ ] Implement config loading
  - Dynamic import for .ts/.mjs/.js files
  - Handle missing configs gracefully
- [ ] Implement config merger
  - Priority: CLI > query-specific > file defaults > root > interactive
  - Deep merge for nested objects
- [ ] Implement profile resolver
  - Resolve profile from CLI, query config, or default
  - Validate profile exists in root config
  - Return resolved ProfileConfig

**Testing:**
- [ ] Unit tests for config discovery
- [ ] Unit tests for config merging priority
- [ ] Unit tests for profile resolution
- [ ] Integration tests with sample configs

**Deliverable:** Config system that loads and merges from all sources

---

## Milestone 3: Plugin System 🔌
**Goal:** Load plugins and create spy/proxy wrapper to intercept execution

**Dependencies:** Milestone 2

**Tasks:**
- [ ] Implement plugin loader (`src/cli/exec/plugin-spy.ts`)
  - Load plugin by package name
  - Support named exports: `package#ExportName`
  - Validate plugin interface (has execute method)
- [ ] Implement plugin spy/proxy
  - Intercept execution methods (getAll, getOne, execute, getMany)
  - Capture query, SQL, params, method name
  - Return promise that resolves when exec command is ready
- [ ] Implement global injection mechanism
  - Inject spy before importing query file
  - Clean up after execution

**Testing:**
- [ ] Unit tests for plugin loading
- [ ] Unit tests for spy interception
- [ ] Mock plugin for testing

**Deliverable:** Plugin system that intercepts and captures query execution

---

## Milestone 4: Param Collection 📝
**Goal:** Collect params from all sources and prompt for missing ones

**Dependencies:** Milestone 1, Milestone 2

**Tasks:**
- [ ] Implement param collector (`src/cli/exec/param-collector.ts`)
  - Extract required params from `query.params`
  - Merge from CLI flags (--param, --params)
  - Merge from query config (params, environments)
  - Merge from file defaults
- [ ] Implement interactive prompts
  - Use `prompts` library
  - Show param name and type
  - Parse input based on type (string, number, array, etc.)
  - Handle comma-separated arrays
- [ ] Implement param parser
  - Parse CLI param values by type
  - Parse JSON params string
  - Validate required params are provided

**Testing:**
- [ ] Unit tests for param merging
- [ ] Unit tests for param parsing
- [ ] Mock prompts for testing

**Deliverable:** Param collection system with interactive fallback

---

## Milestone 5: Output Formatters 📊
**Goal:** Format query results in table, JSON, and CSV formats

**Dependencies:** None (can be developed in parallel)

**Tasks:**
- [ ] Implement table formatter (`src/cli/exec/formatters/table.ts`)
  - Use cli-table3 library
  - Auto-detect column widths
  - Show row count
- [ ] Implement JSON formatter (`src/cli/exec/formatters/json.ts`)
  - Pretty print with indentation
  - Handle empty results
- [ ] Implement CSV formatter (`src/cli/exec/formatters/csv.ts`)
  - Proper escaping for commas/quotes
  - Header row with column names
- [ ] Implement file output
  - Write to specified file path
  - Create parent directories if needed
  - Show success message

**Testing:**
- [ ] Unit tests for each formatter
- [ ] Test with various data types
- [ ] Test file output

**Deliverable:** Output formatters for all supported formats

---

## Milestone 6: Exec Command 🚀
**Goal:** Main valnor exec command that ties everything together

**Dependencies:** Milestones 1-5

**Tasks:**
- [ ] Implement CLI argument parsing (`src/cli/exec/index.ts`)
  - Use commander for --file, --query, --profile, etc.
  - Validate required arguments
- [ ] Implement main execution flow
  - Load configs (root + file-specific)
  - Resolve profile
  - Load plugin and create spy
  - Inject spy globally
  - Dynamic import query file
  - Access query by name from exports
  - Collect params
  - Display SQL and params
  - Execute via plugin (if not dry-run/sql-only)
  - Format and display results
- [ ] Implement error handling
  - Config not found
  - Profile not found
  - Query not found
  - Invalid query object
  - Connection errors
  - Query execution errors
- [ ] Implement safety features
  - --dry-run flag
  - --sql-only flag
  - SQL display before execution

**Testing:**
- [ ] Integration tests with real query files
- [ ] Test all CLI flags
- [ ] Test error scenarios
- [ ] Test with mock plugin

**Deliverable:** Working valnor exec command

---

## Milestone 7: Init Command 🏗️
**Goal:** Generate query config files from query source files

**Dependencies:** Milestone 1, Milestone 2

**Tasks:**
- [ ] Implement init command (`src/cli/exec/init.ts`)
  - CLI argument parsing (--file, --profile, --env, --force)
  - Dynamic import query file
  - Scan for exported sql queries
- [ ] Implement query scanner
  - Iterate over module exports
  - Identify SqlQuery objects (has getSql method)
  - Extract query names
  - Extract params using `query.params`
- [ ] Implement config generator
  - Generate query config structure
  - Add default param values by type
  - Add environment scaffolding
  - Add file defaults
- [ ] Implement interactive prompts
  - Prompt for default profile
  - Prompt for environments list
  - Prompt for default format
- [ ] Implement file writer
  - Check if config file exists
  - Prompt to overwrite (unless --force)
  - Write formatted TypeScript file
  - Show success message

**Testing:**
- [ ] Unit tests for query scanning
- [ ] Unit tests for config generation
- [ ] Integration tests with sample query files
- [ ] Test --force flag

**Deliverable:** Working valnor exec init command

---

## Milestone 8: Integration & Polish ✨
**Goal:** End-to-end testing, documentation, and examples

**Dependencies:** Milestones 6, 7

**Tasks:**
- [ ] Create integration test suite
  - Test full exec flow with real database
  - Test with valnor-postgres plugin
  - Test all output formats
  - Test config priority resolution
  - Test error scenarios
- [ ] Create example project
  - Sample valnor.config.ts
  - Sample query files
  - Sample query config files
  - README with usage examples
- [ ] Update main documentation
  - Add exec command to main README
  - Create wiki page for valnor exec
  - Document all CLI options
  - Add troubleshooting guide
- [ ] Add to existing CLI
  - Register exec command in cli.ts
  - Register exec init subcommand
  - Update help text

**Testing:**
- [ ] Full end-to-end tests
- [ ] Test with multiple databases (postgres, mysql)
- [ ] Performance testing with large result sets

**Deliverable:** Production-ready valnor exec feature

---

## Progress Tracking

### ✅ Completed Milestones
- (none yet)

### 🚧 In Progress
- (none yet)

### 📋 Upcoming
- Milestone 1: Core Extensions
- Milestone 2: Config System
- Milestone 3: Plugin System
- Milestone 4: Param Collection
- Milestone 5: Output Formatters
- Milestone 6: Exec Command
- Milestone 7: Init Command
- Milestone 8: Integration & Polish

### 🔴 Blocked
- (none)

---

## Notes

- Milestones 1-5 can have some parallel development
- Milestone 5 (Output Formatters) is independent and can be done anytime
- Milestone 6 requires all previous milestones
- Milestone 7 can be developed after Milestones 1-2
- Each milestone should be fully tested before moving to next
- Update this file as milestones are completed
