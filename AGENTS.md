<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Tests & CI/CD

GitHub Actions (`.github/workflows/ci.yml`) runs on every push/PR — free, since the repo is public. **Merging to `main` auto-deploys to Fly**, gated on the checks passing (so a broken build/test can't reach prod). The normal flow is: open PR → CI → merge → it ships itself. No manual `fly deploy`.

CI jobs: `test` (`tsc --noEmit` + Vitest + `next build`), `docker` (builds the prod image like `fly deploy`), then `deploy` (push to `main` only).

- Unit tests are `tests/**/*.test.ts` (Vitest, `npm test`).
- CI does `npm install -g npm@11` before `npm ci` — npm 10 misreads the lockfile's optional deps (same workaround as the Dockerfile).

## Visual snapshots (local, optional — NOT in CI)

`tests/visual/` is a small Playwright harness that screenshots the group-home page at 5 viewports (iPhone SE / iPhone 14 / Pixel 7 / iPad / desktop). A global setup seeds a deterministic temp DB + injects a session; clock-dependent text is masked. It's **not run in CI** — it's a convenience for eyeballing UI changes.

Committed baselines are `*-darwin.png` only. After a UI change to the home page:

```
npm run test:visual          # compare against the committed baselines
npx playwright show-report   # Diff / Actual / Expected viewer for any change
npm run test:visual:update   # accept: rewrites the *-darwin.png baselines
```

Then `git add` the changed PNGs. **In the PR, GitHub renders an image diff** (2-up / swipe / onion-skin) for each changed screenshot under *Files changed* — that's how you review the before/after, no artifact download. (Snapshots are per-OS; on a non-macOS machine generate a `*-linux.png` etc. set the same way.)
