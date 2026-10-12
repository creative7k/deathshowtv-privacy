#!/usr/bin/env bash
# Applies the migrations and seed to a throwaway database on a local Postgres, then runs the tests.
# Usage: supabase/tests/run-local.sh   (PG* env vars select the server; defaults to the local socket)
set -euo pipefail
cd "$(dirname "$0")/.."

DB="strange_cams_test_$$"
createdb "$DB"
trap 'dropdb --if-exists "$DB"' EXIT

psql -q -v ON_ERROR_STOP=1 -d "$DB" -f tests/local-shim.sql
for f in migrations/*.sql; do psql -q -v ON_ERROR_STOP=1 -d "$DB" -f "$f"; done
psql -q -v ON_ERROR_STOP=1 -d "$DB" -f seed.sql
psql -q -v ON_ERROR_STOP=1 -d "$DB" -f tests/schema.test.sql
