# valnor-sqlite3

SQLite3 plugin for valnor using better-sqlite3 driver.

## Installation

```bash
npm install valnor-sqlite3 better-sqlite3
```

## Usage

```typescript
import 'valnor-sqlite3'; // Import to register the plugin
import { sql, param } from 'valnor';
import Database from 'better-sqlite3';

const db = new Database('database.db');

// Use the sqlite property on queries
const users = await sql`SELECT * FROM users WHERE id = ${param('id')}`.sqlite.getAll(db, { id: 1 });
```

## Features

- Integration with better-sqlite3
- Type-safe query execution
- Support for all better-sqlite3 query methods

## Requirements

- `better-sqlite3` as peer dependency
- `valnor`

## License

MIT