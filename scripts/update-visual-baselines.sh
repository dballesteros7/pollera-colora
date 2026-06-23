#!/usr/bin/env bash
# Regenerate the Playwright visual baselines after a UI change — BOTH the local
# (*-darwin.png) and CI (*-linux.png) sets, so the `visual` CI job matches.
# The linux set is generated inside the same Playwright container CI uses, so it
# renders identically. Requires Docker for that step.
#
#   npm run test:visual:baselines
#
# Then review and commit tests/visual/**/*-snapshots/.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "→ darwin baselines (local)…"
npx playwright test --update-snapshots

echo "→ linux baselines (Playwright container)…"
PW_VERSION="$(node -e "console.log(require('@playwright/test/package.json').version)")"
docker run --rm \
  -v "$PWD":/work -v /work/node_modules -v /work/.next \
  -w /work -e CI=1 \
  "mcr.microsoft.com/playwright:v${PW_VERSION}-jammy" \
  bash -lc "npm install -g npm@11 >/dev/null 2>&1 && npm ci --no-audit --no-fund && npx playwright test --update-snapshots"

echo "✓ darwin + linux baselines updated. Review the changes and commit tests/visual."
