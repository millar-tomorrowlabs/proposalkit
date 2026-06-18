#!/usr/bin/env bash
#
# Deploy every Supabase edge function in one pass.
#
# Usage:
#   scripts/deploy-functions.sh <project-ref>
#
# Example:
#   scripts/deploy-functions.sh nkygheptubvogevezpap   # production
#   scripts/deploy-functions.sh gpeeosckqysietgryovm   # staging
#
# All functions are deployed with --no-verify-jwt. The app's functions do
# their own auth (Bearer token + getUser, or Svix signature for the Resend
# webhook), and several are called without a Supabase JWT at all (track-view,
# resend-webhook, verify/set-proposal-password). Verifying the platform JWT
# would break those, so we disable it uniformly and rely on per-function
# checks. If a future function needs platform JWT verification, deploy it
# separately without this script.

set -euo pipefail

PROJECT_REF="${1:-}"
if [ -z "$PROJECT_REF" ]; then
  echo "Usage: scripts/deploy-functions.sh <project-ref>" >&2
  exit 1
fi

FUNCTIONS_DIR="$(cd "$(dirname "$0")/.." && pwd)/supabase/functions"

for dir in "$FUNCTIONS_DIR"/*/; do
  name="$(basename "$dir")"
  # Skip shared code directories (prefixed with _).
  case "$name" in
    _*) continue ;;
  esac
  echo "→ deploying $name"
  npx supabase functions deploy "$name" --project-ref "$PROJECT_REF" --no-verify-jwt
done

echo "✓ all functions deployed to $PROJECT_REF"
