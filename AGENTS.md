<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Tests & CI/CD

GitHub Actions (`.github/workflows/ci.yml`) runs on every push/PR — free, since the repo is public. **Merging to `main` auto-deploys to Fly**, gated on all checks passing (so a broken build/test can't reach prod). The normal flow is: open PR → CI → merge → it ships itself. No manual `fly deploy`.

Jobs: `test` (`tsc --noEmit` + Vitest + `next build`), `docker` (builds the prod image like `fly deploy`), `visual` (Playwright), then `deploy` (push to `main` only).

- Unit tests are `tests/**/*.test.ts` (Vitest, run with `npm test`). Visual specs are `tests/visual/*.spec.ts` (Playwright) and are excluded from Vitest and from the app `tsconfig`.
- CI does `npm install -g npm@11` before `npm ci` — npm 10 misreads the lockfile's optional deps (same workaround as the Dockerfile).

## Visual regression tests

`tests/visual/` screenshots the group-home page at 5 viewports (iPhone SE / iPhone 14 / Pixel 7 / iPad / desktop) against committed baselines. A global setup seeds a deterministic temp DB + injects a session; clock-dependent text is masked.

**If you change anything that alters the home page, the screenshots move and the `visual` job fails until you regenerate the baselines.** Baselines are committed per-OS — both `*-darwin.png` (local) and `*-linux.png` (CI). Regenerate BOTH in one command (needs Docker for the linux set, rendered in the same Playwright container CI uses):

```
npm run test:visual:baselines
```

Then review and commit `tests/visual/**/*-snapshots/`.

## Seeing visual diffs

- **Locally**: after a failing `npm run test:visual`, run `npx playwright show-report` — per screenshot it toggles Diff / Actual / Expected with a slider. Raw `*-expected/actual/diff.png` are also under `test-results/`.
- **In CI**: open the run → the `visual` job → download the **`playwright-report`** artifact → open `index.html` (or `npx playwright show-report ./playwright-report`).
