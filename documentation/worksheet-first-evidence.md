# Worksheet-first evidence

This file holds the durable evidence for the worksheet-first controls plan (`documentation/worksheet-first-plan.md`, D38): the suites each step ran, both test counts measured as the plan header declares, per-file deleted and added tests (D23), golden-capture digests, and the outputs of Done-when shell commands. Each step appends its own section. It holds no profile records, no real data and no text from `frontend/test-results/`.

## Step 14: Config module leaves, frozen v1 read path and content baseline

Issue #25. Worktree base `4cf85cf` (the `WORKTREE_BASELINE`; it changes nothing under `frontend/` or `config/` relative to 5c22159, so the 5c22159 test listings and the base listings are the same).

### Gate and counts

- Suites that ran, all green: `npm --prefix frontend run check`, which is ESLint (`eslint . --max-warnings 0`), the three `tsc --noEmit` projects (shared, web, server), the full Vitest suite, the compiled Playwright suite (`test:e2e`: build, then both Playwright projects, `chromium` and `release-smoke`) and the log-privacy calibration (exits 1, 1, 0 as required). `npm --prefix frontend run release:verify` also ran; its result is recorded at the end of this section.
- Vitest count (the `npm test` stage summary): **578 passed (578)**, from 521 at the baseline.
- Playwright count (`Total: N tests in M files` from `playwright test --list` run in `frontend/` with `EXTRA_CREDIT_E2E_BASE_URL=http://127.0.0.1:1`): **161 tests in 11 files**, from 160. The gate's `test:e2e` stage printed `161 passed`.
- This step deletes no test, Vitest or Playwright (D23). The Playwright title list after the step equals the baseline list plus exactly the one new `accessibility.spec.ts` title; every other title is unchanged.
- The final `check` (Vitest 578 passed in 25 files, Playwright 161 passed, calibration exits 1, 1, 0) ran on the final tree, after the bounded-child change below.

### Per-file test changes

Taken from `npx vitest list --json` and the header's `playwright test --list` command, run in `frontend/` before the step's first edit and after its last (re-derived on the final tree, so the `practice-golden.test.ts` count includes the three bounded-child tests), and compared per file by title (line numbers ignored).

Vitest, 521 before and 578 after:

| File | Before | After | Deleted | Added |
|---|---:|---:|---:|---:|
| `src/shared/config/legacy-v1.test.ts` (new) | 0 | 19 | 0 | 19 |
| `tests/integration/config-module-graph.test.ts` (new) | 0 | 6 | 0 | 6 |
| `tests/integration/migrate-fixture.test.ts` (new) | 0 | 4 | 0 | 4 |
| `tests/integration/practice-golden.test.ts` (new) | 0 | 28 | 0 | 28 |

The other 21 Vitest files list the same titles before and after.

Playwright, 160 before and 161 after:

| File | Before | After | Deleted | Added |
|---|---:|---:|---:|---:|
| `tests/e2e/accessibility.spec.ts` | 13 | 14 | 0 | 1 |

The added title is `[chromium] compiled 1920×1080 layout: empty first screen fits and no state scrolls horizontally`. The other 10 spec files list the same titles before and after, including every routed spec and `foundation.spec.ts`, whose development-stack test keeps its title.

### Fixture line endings (Done when 3)

`git check-attr text eol -- frontend/tests/fixtures/config/children.v1.json frontend/tests/fixtures/golden/practice-content-keys.json`:

```text
frontend/tests/fixtures/config/children.v1.json: text: set
frontend/tests/fixtures/config/children.v1.json: eol: lf
frontend/tests/fixtures/golden/practice-content-keys.json: text: set
frontend/tests/fixtures/golden/practice-content-keys.json: eol: lf
```

`git ls-files --eol` for the same two paths, once both were staged:

```text
i/lf    w/lf    attr/text eol=lf      	frontend/tests/fixtures/config/children.v1.json
i/lf    w/lf    attr/text eol=lf      	frontend/tests/fixtures/golden/practice-content-keys.json
```

`children.v1.json` was written from `git show 5c22159:config/children.example.json` by Git Bash redirection. Its SHA-256 is `bea454916bfa6383d07662f9b97fa8ac7dd2ab1cfbbeb3eebc8b41dbe22bd359`, equal to the digest of the 5c22159 blob itself, and `migrate-fixture.test.ts` pins it.

### Golden capture (Done when 4)

Ref `5c22159` (`5c2215943cb92222b864736ddf5e90e052fe8bb2`). The committed `frontend/tests/fixtures/golden/practice-content-keys.json` is the stdout of the first command below, written by Git Bash redirection (never Windows PowerShell 5.1 `>`). It holds 1,392 cells over 16 records (three canonical, ten writing, three arithmetic); every record has 24 cells per family it generates, and Dry Math is absent for the canonical preschool record and the five preschool writing records, whose capabilities have no operations.

Both commands were re-run with the final script, after the bounded-child change below. The committed grid is unchanged.

1. `node frontend/scripts/capture-practice-golden.mjs 5c22159`, run from the repository root: exit 0, stdout byte-identical to the committed grid (SHA-256 `49e27e1e8bb5aea0e0f0b17635f20775787351611b3ce84d6415438bc238cb41`). Its stderr:

   ```text
   temporary export removed: <TEMP>\extra-credit-golden-FJGs1g
   checkout dependencies intact: frontend/node_modules/vitest/package.json
   captured 5c22159 (5c2215943cb92222b864736ddf5e90e052fe8bb2)
   ```

2. `node frontend/scripts/capture-practice-golden.mjs 5c22159 --compare frontend/tests/fixtures/golden/practice-content-keys.json`: exit 0. Its stdout, then stderr:

   ```text
   capture sha256:   49e27e1e8bb5aea0e0f0b17635f20775787351611b3ce84d6415438bc238cb41
   committed sha256: 49e27e1e8bb5aea0e0f0b17635f20775787351611b3ce84d6415438bc238cb41
   MATCH
   temporary export removed: <TEMP>\extra-credit-golden-8XT4oo
   checkout dependencies intact: frontend/node_modules/vitest/package.json
   captured 5c22159 (5c2215943cb92222b864736ddf5e90e052fe8bb2)
   ```

`<TEMP>` stands for the OS temporary directory. After both runs no `extra-credit-golden-` directory remained there, `frontend/node_modules/vitest/package.json` still existed, and `git status --porcelain` listed only this step's files. Five earlier runs with the first version of the script (three captures and two `--compare`) produced the same grid digest. `practice-golden.test.ts` pins that digest, reproduces every committed hash through the current path, shows that the current path generates no cell the grid lacks, and calibrates the perturbation (`operandMax` minus one changes hashes), both pure comparisons, the nonexistent-ref run and the bounded child process.

**Bounded child and interrupts.** Every child process the script starts is bounded: each `git` and `tar` call has a five-minute timeout, and the capture form runs through the exported `runBounded` with a twelve-minute bound, above the form's own 600-second Vitest timeout. When the bound expires, `runBounded` kills the whole process tree (`taskkill /T /F` on Windows; on other platforms the child starts detached and its process group is killed), waits at most 30 seconds for the child to exit and rejects, so `finally` still unlinks the junction first, removes the export and checks `frontend/node_modules/vitest/package.json`. When the script is invoked directly, SIGINT, SIGTERM and SIGHUP abort the same way instead of exiting at once, and the script then exits 1. `practice-golden.test.ts` adds three tests: exit 0 resolves with the output and exit 3 rejects with it; an expired 4,000 ms bound kills a child and the grandchild it started, both verified gone; an aborted signal kills the child long before a 120-second bound. Calibration: with `/T` removed from the `taskkill` call, the process-tree test failed (the grandchild was still running) and the other two passed; the restored script passes all three. The non-Windows branch was checked under WSL Ubuntu (Node 22.23.0) with a scratch driver of the same two scenarios, since the suite runs only on Windows here: the process-group kill ended the child and the grandchild, and with the group kill replaced by a kill of the child alone the grandchild survived. The negative ref run now points `TEMP`, `TMP` and `TMPDIR` at a directory the test owns, probes that a child with that environment resolves `os.tmpdir()` there, and asserts that directory holds no `extra-credit-golden-` entry afterwards, so a concurrent capture elsewhere cannot fail it.

Two development runs exercised the real script at 5c22159, each restored byte-identical afterwards. With the capture-form bound temporarily set to 400 ms, it exited 1 with `The capture form failed: node.exe did not finish within 400 ms; its process tree was killed.`. With a SIGINT emitted inside the process 1.2 seconds in (`node --import "data:text/javascript,setTimeout(()=>process.emit('SIGINT','SIGINT'),1200).unref()" frontend/scripts/capture-practice-golden.mjs 5c22159`), it printed `SIGINT received; stopping the capture and removing the temporary export.` and exited 1 with `The capture form failed: node.exe was stopped (interrupted by SIGINT); its process tree was killed.`. Both runs printed `temporary export removed` and `checkout dependencies intact`, left no `extra-credit-golden-` directory under `<TEMP>`, and left no `node.exe` process whose command line names an export.

### Main-checkout gate relocation (Done when 6)

- `npm --prefix frontend run test:e2e -- --project=chromium foundation.spec.ts accessibility.spec.ts` passed (29 passed) with 4310 and 4311 free, including the new 1920×1080 test and the development-stack test.
- `grep -nE "scrollHeight|scrollWidth|clientHeight|setViewportSize" frontend/tests/e2e/foundation.spec.ts` finds nothing (exit 1). The development-stack test's one status locator is `page.locator(".health").getByRole("status")`; its proxied health response and status text, single `/api/health` request, post-restart health response and every `/@fs/` 403 and 200 probe are unchanged.

### Helper routing and unchanged paths (Done when 5 and 7)

- The §7 standing grep over the nine helper-routed control names in `frontend/tests/e2e/*.spec.ts` finds nothing (exit 1), and no spec names `More options` any more.
- `git diff --exit-code $(git merge-base HEAD main) -- frontend/src/server frontend/src/web frontend/src/worksheets frontend/src/shared/worksheet frontend/tests/e2e/fixtures/app-server.ts frontend/tests/e2e/server-harness.mjs frontend/tests/e2e/log-privacy-calibration.mjs frontend/tests/fixtures/print frontend/tests/fixtures/profiles.ts frontend/scripts/audit-release.mjs config` exits 0.

### Files and notes

Every file this step touched is on its Files list; none was added beyond it. Routed specs: `accessibility`, `count-compare-make`, `dry-math`, `find-the-wow`, `graphics`, `options`, `print`, `release-smoke` and `sentence-builder`; `profile-flow.spec.ts` selects none of the routed controls and is unchanged.

- `schema.ts` does not import the four field helpers at this step: after the move none of its code uses them, and an unused import fails `eslint --max-warnings 0`. It re-exports none of them, which `legacy-v1.test.ts` asserts; the Step 15 v2 schemas are their first importer there.
- The inferred types `MathSkillsV1`, `ChildProfileV1`, `GenerationDefaultsV1` and `AppConfigV1` moved with their schemas into `legacy-v1.ts`, and `schema.ts` re-exports them as types. `PresentationBand` and `WritingMode` stay defined in `schema.ts` from the `enums.ts` arrays, because `enums.ts` holds only the arrays.
- The helper's `length()` accessor matches the Length combobox by exact name. Some specs used the non-exact name before; the page has one Length combobox, so both resolve to the same element.
- `dry-math.spec.ts` and `find-the-wow.spec.ts` keep their two absence assertions over any label matching `/interest/i` or `/decorative/i`. Those regular expressions reach more than the named accessors do, so narrowing them to `controls(page)` would change an assertion.
- The capture tool's runtime-built records come from its exported `buildGoldenRuntimeRecords`: the capture form embeds that function's source, and `practice-golden.test.ts` imports it, so both sides build the same records from one definition.
- Each routed spec imports `worksheet-controls` with the same extension as its pre-existing `./fixtures/app-server` import: at `4cf85cf`, `count-compare-make`, `find-the-wow`, `graphics`, `options`, `print` and `sentence-builder` import `./fixtures/app-server.ts`, and `accessibility`, `dry-math` and `release-smoke` import `./fixtures/app-server.js` (`tsconfig.server.json` sets `allowImportingTsExtensions`), so the mixed extensions are pre-existing and unchanged.

### Release clean room (Done when 8)

`npm --prefix frontend run release:verify` was re-run on the final tree, after the bounded-child change, and exited 0 with status PASS: the exported working tree passed the release audit (166 files, 6 assets), a locked clean-room install and Chromium install, and the full `check` there (Vitest 578 passed in 25 files, Playwright 161 passed, log-privacy calibration exits 1, 1, 0), and the clean room was removed. These counts equal the final tree's own `check` above. An earlier release:verify run, made before the bounded-child change added its three `practice-golden.test.ts` tests, also passed with Vitest 575; it is superseded and describes no final tree.
