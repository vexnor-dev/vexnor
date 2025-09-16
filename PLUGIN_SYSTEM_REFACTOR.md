# Plugin System Refactor Summary

## Overview
Successfully refactored the valnor codebase to implement a plugin system with the following packages:

## New Package Structure

### 1. `valnor-core` 
- **Purpose**: Core SQL query generation library with reasonable defaults
- **Location**: `packages/valnor-core/`
- **Exports**: All core functionality including SQL query building, table/column abstractions, parameter handling, and plugin system support
- **Dependencies**: `pino` for logging, `@types/pg` (dev), optional peer dependency on `pg`

### 2. `valnor-sqlite3`
- **Purpose**: SQLite3 plugin using better-sqlite3 library
- **Location**: `packages/valnor-sqlite3/`
- **Functionality**: 
  - Moved `BetterSqlite3QueryHandler` from main valnor package
  - Implements database querying for SQLite3
  - Extends SqlQuery with `.sqlite` property for query execution
- **Dependencies**: `valnor-core`, `better-sqlite3` (peer dependency)

### 3. `valnor` (Updated)
- **Purpose**: Main CLI package and PostgreSQL support (existing functionality preserved)
- **Changes**: 
  - Now depends on `valnor-core` 
  - Removed SQLite-specific code
  - CLI functionality remains intact for PostgreSQL schema generation
  - Re-exports everything from `valnor-core`

## Key Changes Made

### Code Movement
- **Core library files**: Moved from `packages/valnor/src/lib/` to `packages/valnor-core/src/lib/`
- **SQLite handler**: Moved from `packages/valnor/src/lib/clients/better-sqlite3-query-handler.ts` to `packages/valnor-sqlite3/src/`

### Import Updates
- Updated all CLI imports to use `valnor-core` instead of relative paths
- Fixed module declarations in SQLite plugin to reference `valnor-core`

### Configuration Updates
- Added TypeScript project references between packages
- Updated build scripts to build packages in dependency order
- Added composite TypeScript builds with declaration generation

### Dependency Management
- Removed SQLite-specific dependencies from main valnor package
- Added proper peer dependencies for database drivers
- Established workspace dependencies between packages

## Usage Examples

### Using valnor-core directly:
```typescript
import { sql, param, newTable } from 'valnor-core';

const Users = newTable(
  { name: 'users', schema: 'public' },
  { id: 'id', name: 'name', email: 'email' }
);

const query = sql`SELECT ${Users.$$all} FROM ${Users} WHERE ${Users.id} = ${param('userId')}`;
```

### Using valnor-sqlite3 plugin:
```typescript
import 'valnor-sqlite3'; // Register the plugin
import { sql, param } from 'valnor-core';
import Database from 'better-sqlite3';

const db = new Database('database.db');
const users = await sql`SELECT * FROM users WHERE id = ${param('id')}`.sqlite.getAll(db, { id: 1 });
```

### Using main valnor package (unchanged):
```bash
npx valnor generate --cli your_schema --uri $POSTGRES_URI --outDir 'src/codegen'
```

## Build Order
1. `valnor-core` (foundation)
2. `valnor-sqlite3` (plugin depending on core)  
3. `valnor` (main package depending on core)
4. Other packages

## Benefits
- **Modularity**: Core functionality separated from database-specific implementations
- **Extensibility**: Easy to add new database plugins following the same pattern
- **Maintainability**: Clear separation of concerns
- **Backward Compatibility**: Existing valnor usage remains unchanged
- **Plugin System**: Foundation for future database driver plugins (MySQL, MSSQL, etc.)