BEGIN;

PRAGMA foreign_keys=OFF;

DROP TABLE IF EXISTS "order_item";
DROP TABLE IF EXISTS "order";

PRAGMA foreign_keys=ON;

COMMIT;