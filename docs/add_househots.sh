#!/usr/bin/env bash
set -euo pipefail

SOURCE_ROOT="${1:-../maple-market-supermarket}"
node "$(dirname "$0")/../scripts/import-evidence.mjs" "$SOURCE_ROOT"

