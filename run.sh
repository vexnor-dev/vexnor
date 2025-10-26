#!/bin/bash

# Define the base path for the testing-e2e package
E2E_PATH="packages/testing-e2e"

echo "Starting file and directory restructuring for $E2E_PATH..."

# --- Create new directories ---
echo "Creating new directories..."
mkdir -p "$E2E_PATH/src/e2e/features"
mkdir -p "$E2E_PATH/src/e2e/step_definitions/mssql"
mkdir -p "$E2E_PATH/src/e2e/step_definitions/sqlite"
mkdir -p "$E2E_PATH/src/e2e/step_definitions/postgres"
mkdir -p "$E2E_PATH/src/e2e/hooks"
echo "New directories created."

# --- Move feature files ---
echo "Moving feature files..."
git mv "$E2E_PATH/features/mssql.feature" "$E2E_PATH/src/e2e/features/mssql.feature"
git mv "$E2E_PATH/features/sqlite.feature" "$E2E_PATH/src/e2e/features/sqlite.feature"
git mv "$E2E_PATH/features/postgres.feature" "$E2E_PATH/src/e2e/features/postgres.feature"
git mv "$E2E_PATH/features/postgres-stress.feature" "$E2E_PATH/src/e2e/features/postgres-stress.feature"
echo "Feature files moved."

# --- Move step definition files (MSSQL) ---
echo "Moving MSSQL step definition files..."
git mv "$E2E_PATH/src/steps/mssql/db-order-steps.ts" "$E2E_PATH/src/e2e/step_definitions/mssql/db-order-steps.ts"
git mv "$E2E_PATH/src/steps/mssql/db-account-steps.ts" "$E2E_PATH/src/e2e/step_definitions/mssql/db-account-steps.ts"
git mv "$E2E_PATH/src/steps/mssql/generated-code-steps.ts" "$E2E_PATH/src/e2E/step_definitions/mssql/generated-code-steps.ts"
echo "MSSQL step definition files moved."

# --- Move step definition files (SQLite) ---
echo "Moving SQLite step definition files..."
git mv "$E2E_PATH/src/steps/sqlite/db-order-steps.ts" "$E2E_PATH/src/e2e/step_definitions/sqlite/db-order-steps.ts"
git mv "$E2E_PATH/src/steps/sqlite/db-account-steps.ts" "$E2E_PATH/src/e2e/step_definitions/sqlite/db-account-steps.ts"
git mv "$E2E_PATH/src/steps/sqlite/generated-code-steps.ts" "$E2E_PATH/src/e2e/step_definitions/sqlite/generated-code-steps.ts"
echo "SQLite step definition files moved."

# --- Move step definition files (PostgreSQL) ---
echo "Moving PostgreSQL step definition files..."
git mv "$E2E_PATH/src/steps/postgres/db-order-steps.ts" "$E2E_PATH/src/e2e/step_definitions/postgres/db-order-steps.ts"
git mv "$E2E_PATH/src/steps/postgres/db-account-steps.ts" "$E2E_PATH/src/e2e/step_definitions/postgres/db-account-steps.ts"
git mv "$E2E_PATH/src/steps/postgres/generated-code-steps.ts" "$E2E_PATH/src/e2e/step_definitions/postgres/generated-code-steps.ts"
git mv "$E2E_PATH/src/steps/postgres/postgres-stress.steps.ts" "$E2E_PATH/src/e2e/step_definitions/postgres/postgres-stress.steps.ts"
echo "PostgreSQL step definition files moved."

# --- Move hooks and test-world files ---
echo "Moving hooks and test-world files..."
git mv "$E2E_PATH/src/hooks/after-all-hook.ts" "$E2E_PATH/src/e2e/hooks/after-all-hook.ts"
git mv "$E2E_PATH/src/test-world.ts" "$E2E_PATH/src/e2e/test-world.ts"
echo "Hooks and test-world files moved."

# --- Remove old, now empty directories ---
echo "Removing old directories..."
rmdir "$E2E_PATH/features"
rmdir "$E2E_PATH/src/steps/mssql"
rmdir "$E2E_PATH/src/steps/sqlite"
rmdir "$E2E_PATH/src/steps/postgres"
rmdir "$E2E_PATH/src/steps"
rmdir "$E2E_PATH/src/hooks"
echo "Old directories removed."

echo "All files moved and directories cleaned up using git mv. File history is preserved."
echo "Next, I will update the import paths within the moved files and the cucumber.mjs configuration."