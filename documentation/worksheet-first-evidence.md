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

## Step 15: Config schema v2 with lossless v1 upgrade and age-free profiles

Issue #26. Worktree base `c75e047` (Step 14's checkpoint; the `WORKTREE_BASELINE`).

### Gate and counts

- Suites that ran, all green, on the final tree: `npm --prefix frontend run check`, which is ESLint (`eslint . --max-warnings 0`), the three `tsc --noEmit` projects (shared, web, server), the full Vitest suite, the compiled Playwright suite (`test:e2e`: build, then both Playwright projects, `chromium` and `release-smoke`) and the log-privacy calibration. `npm --prefix frontend run release:verify` also ran; its result is recorded at the end of this section.
- Vitest count (the `npm test` stage summary): **686 passed (686)** in 27 files, from 578.
- Playwright count (`Total: N tests in M files` from `playwright test --list` run in `frontend/` with `EXTRA_CREDIT_E2E_BASE_URL=http://127.0.0.1:1`): **162 tests in 11 files**, from 161. The gate's `test:e2e` stage printed `162 passed`.
- Log-privacy calibration: `dedicated stdout leak` exit 1, `default-selector deleted-ID stderr leak` exit 1, `restored clean compiled app` exit 0; the script asserted the `reply.header("ETag", stored.etag);` anchor twice (GET and PUT) before injecting. The deleted-profile leak is now keyed on `profile.displayName === "Temporary"`.

### Per-file test changes (D23)

Taken from `npx vitest list --json` and the header's `playwright test --list` command, run in `frontend/` before the step's first edit and after its last, compared per file by full title (describe path plus name). A title that changed counts as one deletion and one addition.

Vitest, 578 before and 686 after:

| File | Before | After | Deleted | Added |
|---|---:|---:|---:|---:|
| `src/shared/config/profile-support.test.ts` (deleted with the age gate) | 15 | 0 | 15 | 0 |
| `src/shared/config/migrate.test.ts` (new) | 0 | 21 | 0 | 21 |
| `src/shared/config/legacy-v1.test.ts` | 19 | 19 | 1 | 1 |
| `src/shared/worksheet/project-request.test.ts` | 22 | 27 | 12 | 17 |
| `src/web/profiles/ProfileEditor.test.tsx` | 29 | 36 | 10 | 17 |
| `src/web/generator/options.test.tsx` | 20 | 25 | 0 | 5 |
| `src/web/worksheets/registry.test.ts` | 52 | 52 | 2 | 2 |
| `tests/integration/schema-parity.test.ts` | 17 | 69 | 17 | 69 |
| `tests/integration/config-store.test.ts` | 14 | 25 | 0 | 11 |
| `tests/integration/config-upgrade.test.ts` (new) | 0 | 7 | 0 | 7 |
| `tests/integration/config-shape-fingerprint.test.ts` (new) | 0 | 7 | 0 | 7 |
| `tests/integration/migrate-fixture.test.ts` | 4 | 7 | 0 | 3 |
| `tests/integration/release-audit.test.ts` | 60 | 65 | 0 | 5 |

The other 14 Vitest files list the same titles before and after, including `limit-labels.test.ts` (10 and 10: the arm catalogue and its sweep keep their titles; see the arm record below), `practice-golden.test.ts` (28), `shipped-profile-options.test.ts`, `config-api.test.ts`, `security.test.ts`, `config-module-graph.test.ts`, `manifest.test.ts` and the four generator tests.

Deleted tests and their replacements:

- `profile-support.test.ts` (15: `supports age 4`–`8`, `retains but does not generate for age 9`–`18`) is removed with `profile-support.ts`. Its contract (age gates generation) is retired by P2; the replacement contract tests are the new `migrate.test.ts` (21), the `project-request.test.ts` additions below and the schema-parity rows that refuse `ageYears` at every object level.
- `project-request.test.ts` deletes the 12 age tests (`accepts an equation-capable profile at the age-4/8 boundary`, `rejects age 9`–`18 before constructing a request or invoking a generator`) and adds 17: four `projects <family> from a capability profile with no age, identity or review field in the request`, `a malformed seed is refused before any generator runs, with no age gate ahead of it`, four `capabilityProfileOf` contract tests (verbatim flatten, `undefined` without `legacyChoices`, round trip through `profileWithLegacyChoices` with no shared arrays, the capability schema refuses an age key), and eight `a migrated v1 profile at preset <key> projects exactly as the v1 original` (one per concrete `MATH_PRESETS` key, every family).
- `ProfileEditor.test.tsx` deletes the 10 age tests (`shows the complete exact age-4/6/7/8 suggestion`, `leaves both age-five suggestions unselected until the parent chooses`, `submits the exact expanded age-four preset after explicit confirmation`, `retains age nine as unsupported after a parent chooses capabilities`, `rejects age 3/19 without submitting`, `age changes never alter capabilities loaded as parent-confirmed`) and adds 17: four `shows the complete expansion of <preset> once the parent chooses it`, `each advanced capability field carries its frozen v1 bounds` (its min/max attributes are the frozen `MathSkillsV1Schema` fields' own bounds), `no age input exists and a new profile starts with no preset chosen`, `shows the early-primary help text verbatim, with no age word`, `a new profile cannot be saved until a preset is chosen, then saves legacyChoices and no age`, `a preset with an open vocabulary needs an explicit vocabulary before saving`, `submits the exact expanded Quantities to 10 preset chosen explicitly`, `a migrated profile opens on its stored preset and vocabulary`, `editing only a migrated profile's nickname preserves its legacyChoices deep-equal`, `a profile stored without earlier settings must choose a preset before it saves`, and the new App-level describe `App over a file an earlier version saved`: `the interim defaults save passes every worksheet group and the seeding flag through` (Done when 7, D-save), `shows the upgrade notice for a version 1 file until the first save upgrades it`, `a version 2 file shows no upgrade notice`, `the recovery panel states what stays only in the backup before confirmation`.
- `registry.test.ts` replaces `Make another > age support fails before a lifecycle ID or injected generator is called` with the same-shape `Make another > a profile without earlier settings is refused before a lifecycle ID or injected generator is called` (§4). It also renames `a stored stretch default never blocks a family that hides difficulty` to `a stretch chosen on another family never blocks a family that hides difficulty`: Difficulty is session-only from this step, so no stored stretch default exists; the test now chooses Stretch on Dry Math before switching to Sentence Builder and keeps every assertion.
- `legacy-v1.test.ts` renames `APP_CONFIG_SCHEMA_VERSION is still 1 and the v1 schema accepts only 1` to `APP_CONFIG_SCHEMA_VERSION is 2 while the frozen v1 schema still accepts only 1` (the version assertion moves to 2; the frozen `AppConfigV1Schema` literal is still pinned at 1).
- `schema-parity.test.ts` is rebuilt around one parity row per transport key path (Done when 4). All 17 earlier titles change: the nine `classifies age N identically` tests and `pins every age suggestion without silently advancing a profile` are retired with age; the three `rejects … unknown at both validation layers` tests, `rejects duplicate identities/tags and invalid capability ordering`, the v1 code-set pin and `keeps transport transform-free and Zod authoritative` are replaced by the 58 per-path parity rows (one per key path the composed transport schema declares) (every object level refuses `ageYears`, `difficulty` and an unknown key; duplicate ids, case-insensitive duplicate interests, reversed canonical order and mismatched legacy limits are explicit probes), `calibration: the row identity check rejects exactly the one enum restated as a copy` (the per-path rows' own identity function, run over a structured copy of the transport schema in which only `$.defaults.theme` is a restated copy, rejects exactly that path), `the legacy mathSkills transport bounds are the frozen v1 fields' own bounds`, `calibration: the bound reader follows the field and refuses an unbounded one`, two `<file> never restates a frozen legacy ceiling as a literal` (the transport schema and `MathSkillsEditor.tsx`, scanned as TypeScript syntax trees, with a planted-literal calibration), `pins the complete public machine-code set at 20, without the retired age code`, the retitled `keeps transport transform-free and Zod authoritative`, and `parses the committed fictional example and pins exact presets` under the new describe `the frozen version 1 read path`, which also adds `the frozen v1 schema refuses a version 2 body, and the v2 schema a version 1 body`.

Playwright, 161 before and 162 after:

| File | Before | After | Deleted | Added |
|---|---:|---:|---:|---:|
| `tests/e2e/profile-flow.spec.ts` | 4 | 5 | 0 | 1 |

The added title is `[chromium] upgrades a version 1 file only on the first explicit save, behind one byte-identical backup`. Every other title is unchanged, including `compiled release profile-to-print and privacy gate` and the Step 14 title `compiled 1920×1080 layout: empty first screen fits and no state scrolls horizontally`. No title contains an example id, nickname or interest word.

Assertion changes inside unchanged titles, as the Done when requires:

- `release-smoke.spec.ts`: profiles are created by choosing a preset explicitly (no age field exists, asserted); earlier capabilities are read from `legacyChoices`; the four-family age-unavailable loop is replaced by the age-free Temporary profile, whose `legacyChoices` equal the oldest canonical child's: every family's Create is enabled, no age-support message renders, and the retained record still deep-equals after the reload. The profile list and generator panel text match no `/\bages?\b/i` (asserted before and after the Temporary profile).
- `profile-flow.spec.ts`: profiles are created through explicit presets; the created file is version 2 (`createdConfig`), external reloads use in-spec v1 seeds as read-path coverage; the recovery panel shows the fixed disclosure text verbatim before confirmation, its draft-download copy matches no `/\bages?\b/i`, and the downloaded draft is a version 2 config with no age.
- `accessibility.spec.ts`: the keyboard flow selects the preset radio by keyboard instead of typing an age.
- `dry-math.spec.ts`: the stored-age-9 child is now available (no age message, Create enabled); a version 1 seed also renders the upgrade notice, so the print-hidden `.print-controls` count is 4, with the notice among them.
- `options.spec.ts`: saved configs are compared with the classifier's upgrade of each in-spec v1 fixture.
- `print.spec.ts`: the manual-harness body is `{ config: acceptanceConfig, storedSchemaVersion: 1 }`; the count-order test seeds the fixture's version 2 `defaults`.
- `foundation.spec.ts` is unchanged.

### Arm catalogue (Done when 10)

`limit-labels.test.ts` re-declares `PS-projection-fail` as dead with the age-removal reason (the sweep projects only confirmed stretch, and the age-9 `beyondV1AgeProfile` was its only producer), drops `beyondV1AgeProfile` from `PROBE_PROFILES` (one probe fewer), and removes the age message from `DECLARED_SENTENCE_SHAPES`. The observed arm set equals the declared reachable set, `PS-projection-fail` is not observed, and the observed sentence shapes equal the declared list. The file's test count is unchanged (10 and 10).

### Golden continuity (Done when 9, §7 standing check)

`practice-golden.test.ts` reproduces every committed hash through `classifyStoredConfig`, then `capabilityProfileOf` and the unchanged projection at Practice (the canonical records from `children.v1.json`, the runtime records wrapped in a runtime-built v1 file); the perturbation case still changes hashes. `git diff --exit-code c75e047 -- frontend/tests/fixtures/golden` exits 0.

`node frontend/scripts/capture-practice-golden.mjs 5c22159 --compare frontend/tests/fixtures/golden/practice-content-keys.json`, run from the repository root by this step's developer: exit 0.

```text
temporary export removed: <TEMP>\extra-credit-golden-fT5zdv
checkout dependencies intact: frontend/node_modules/vitest/package.json
captured 5c22159 (5c2215943cb92222b864736ddf5e90e052fe8bb2)
capture sha256:   49e27e1e8bb5aea0e0f0b17635f20775787351611b3ce84d6415438bc238cb41
committed sha256: 49e27e1e8bb5aea0e0f0b17635f20775787351611b3ce84d6415438bc238cb41
MATCH
```

### Upgrade digests (Done when 1)

- The v1 fixture byte pin is unchanged: `bea454916bfa6383d07662f9b97fa8ac7dd2ab1cfbbeb3eebc8b41dbe22bd359` (`git ls-files --eol` still reports `i/lf w/lf` for `children.v1.json` and the golden grid).
- The golden upgraded digest, the SHA-256 of `serializeAppConfig(AppConfigV2Schema.parse(migrateConfigV1ToV2(v1)))` over the fixture (3,265 bytes): `2bf677155c66df8c302c868bec35a8144bd2f7564a506a3ba44d21a2c2136528`. `migrate-fixture.test.ts` pins it (as `GOLDEN_UPGRADED_V1_FIXTURE_SHA256` in `tests/fixtures/profiles.ts`), shows `classifyStoredConfig` returns that parsed object, and shows a one-field change to a runtime copy moves it; `config-upgrade.test.ts` finds the same digest on the file a real first PUT wrote.

### Files and notes

- One file outside the Files list: `frontend/tests/fixtures/config-shape.ts`, the shared reader of the composed transport schema that both `schema-parity.test.ts` (one parity row per key path) and `config-shape-fingerprint.test.ts` (the pinned lines) use, so both tests list exactly the same paths.
- `CapabilityProfileV1`, its schema, `capabilityProfileOf`, `profileWithLegacyChoices` and `NO_EARLIER_SETTINGS_MESSAGE` live in `project-request.ts` (interim, D-interim). `GenerationSelection.profile` is the stored version 2 profile, so `createWorksheetSessionForSeed` refuses a profile without `legacyChoices` before a lifecycle ID or generator; the controls show the same message.
- The four generator tests and `manifest.test.ts` also retype their fixtures from `ChildProfileV1` to `CapabilityProfileV1` (a v1 profile without age would not typecheck as `ChildProfileV1`); `manifest.test.ts`'s review-date parity test now compares against the version 2 profile schema.
- `UpgradeNotice` carries `print-controls`, the existing print-hidden class, so the notice never prints; no print CSS changed.
- `MathSkillsEditor` loses its "Confirm suggested capabilities" button with the age suggestion that was its only producer: every preset is now chosen explicitly.
- The legacy `mathSkills` integer bounds are written only in the frozen `legacy-v1.ts`. `transport-schemas.ts` builds each of the five legacy integer nodes with `zodIntegerBounds(MathSkillsV1Schema.shape.<field>)`, which reads Zod's `minValue`/`maxValue` and throws on a non-integer or one-sided field; `MathSkillsEditor`'s advanced inputs read the same fields for `min`/`max`. The previous hand-written `LEGACY_MATH_MAXIMUM = 1_000` constant and the editor's `max={1_000}` are gone, and `CONTRIBUTING.md` § "One source for every value" names the frozen fields as the only source.
- `seedConfig` accepts v1 or v2; `readConfig()` returns the classifier's `config` and throws on `future` or `invalid` (D41).

### Release clean room (Done when 6 and 11)

`npm --prefix frontend run release:verify` ran as the last command, after every edit including this subsection, and exited 0 with status PASS: the exported working tree passed the release audit (171 files, 6 assets) with the detector keyed on `id`, `reviewedOn` and `interests`, then a locked clean-room install, Chromium install and the full `check` there (Vitest 686 passed in 27 files, Playwright 162 passed, log-privacy calibration exits 1, 1, 0), and the clean room was removed. These counts equal the final tree's own `check` above.

## Step 16: Practice focus replaces Difficulty in generation

Issue #27. Worktree base `29808e7` (Step 15's checkpoint; the `WORKTREE_BASELINE`).

### Gate and counts

- Suites that ran, all green, on the final tree: `npm --prefix frontend run check`, which is ESLint (`eslint . --max-warnings 0`), the three `tsc --noEmit` projects (shared, web, server), the full Vitest suite, the compiled Playwright suite (`test:e2e`: build, then both Playwright projects, `chromium` and `release-smoke`) and the log-privacy calibration.
- Vitest count (the `npm test` stage summary): **768 passed (768)** in 31 files, from 686 in 27.
- Playwright count (`Total: N tests in M files` from `playwright test --list` run in `frontend/` with `EXTRA_CREDIT_E2E_BASE_URL=http://127.0.0.1:1`): **162 tests in 11 files**, from 162. The gate's `test:e2e` stage printed `162 passed`.
- Log-privacy calibration: `dedicated stdout leak` exit 1, `default-selector deleted-ID stderr leak` exit 1, `restored clean compiled app` exit 0, with the `reply.header("ETag", stored.etag);` anchor asserted twice before injecting. The final `check` ran alone, after every source, test and evidence edit except the recording of these results.

### Per-file test changes (D23)

Taken from `npx vitest list --json` and the header's `playwright test --list` command, run in `frontend/` before the step's first edit and after its last source edit, compared per file by full title (describe path plus name). A title that changed counts as one deletion and one addition.

Vitest, 686 before and 768 after:

| File | Before | After | Deleted | Added |
|---|---:|---:|---:|---:|
| `src/shared/config/practice-focus.test.ts` (new) | 0 | 12 | 0 | 12 |
| `src/shared/config/earlier-settings.test.ts` (new) | 0 | 12 | 0 | 12 |
| `src/shared/worksheet/project-request.test.ts` | 27 | 58 | 20 | 51 |
| `src/shared/worksheet/limit-labels.test.ts` | 10 | 11 | 1 | 2 |
| `src/web/generator/options.test.tsx` | 25 | 27 | 4 | 6 |
| `src/web/worksheets/registry.test.ts` | 52 | 56 | 8 | 12 |
| `src/worksheets/dry-math/generator.test.ts` | 30 | 32 | 0 | 2 |
| `src/worksheets/find-the-wow/generator.test.ts` | 29 | 30 | 2 | 3 |
| `src/worksheets/sentence-builder/generator.test.ts` | 45 | 46 | 1 | 2 |
| `src/worksheets/count-compare-make/generator.test.ts` | 52 | 53 | 0 | 1 |
| `tests/integration/practice-golden.test.ts` | 28 | 28 | 2 | 2 |
| `tests/integration/shipped-profile-options.test.ts` | 1 | 5 | 0 | 4 |
| `tests/integration/config-module-graph.test.ts` | 6 | 8 | 0 | 2 |
| `tests/integration/earlier-settings-canonical.test.ts` (new) | 0 | 5 | 0 | 5 |
| `tests/integration/parent-copy-scan.test.ts` (new) | 0 | 4 | 0 | 4 |

Every other Vitest file lists the same titles before and after, including `ProfileEditor.test.tsx` (36), `manifest.test.ts` (75), `plan-citations.test.ts`, `envelope-single-source.test.ts` and `config-shape-fingerprint.test.ts`.

Deleted or retitled tests and their named replacements:

- `project-request.test.ts`
  - The four `projects <family> from a capability profile with no age, identity or review field in the request` become `projects <family> from a worksheet selection with no age, identity or review field in the request` (the input is now the selection).
  - `projects an exact age-free allowlist and clamps future capabilities` becomes `projects an exact age-free allowlist with both permission flags false`: the projection no longer clamps, because the selection schema bounds every focus; the clamp of a stored value moved to `selectionFromEarlierSettings` (`earlier-settings.test.ts`, maxima 50 and 1,000).
  - `difficulty changes only activity-relevant maxima after the V1 clamp` and `normalizes ineffective maximum stretch to practice` are deleted with Difficulty. Replacements (Done when 2): the 16 `the practice focus reaches the request exactly > <family> <option> projects its exact ...` rows (every catalog option), `within 100 projects 100 and 100, with no value scaled`, `each family's capabilities follow the exact projected-capability table`, `the inactive pins are the quantities-to-10 shape and the default Sentence choices`, the four `"difficulty" is absent from the <family> request options`, the fast-check property `varying inactive fields, other families' focus, inapplicable controls and the Sentence choices leaves every non-Sentence request and its items unchanged` (200 runs) and its three `mirror: a different <family> focus with the same seed changes the items`.
  - `canonicalizes Sentence Builder controls that are hidden by writing mode` becomes `... hidden by writing activity` (same assertions, no Difficulty).
  - The `capabilityProfileOf` describe (four contract tests and eight `a migrated v1 profile at preset <key> projects exactly as the v1 original`) is deleted with `capabilityProfileOf`. Replacements: the eight `the child only personalizes > a migrated v1 child at preset <key> projects its preset values through its earlier settings`, the four `two children with different earlier settings but the same nickname and interests project the same <family> request`, `a child without earlier settings projects the same request as one with them`, `a child-free probe projects no nickname and no topics`, `an invalid generator version is refused before any generator runs`; the round-trip and age-refusal contracts of the moved `profileWithLegacyChoices` and `CapabilityProfileV1Schema` are in `earlier-settings.test.ts` (`profileWithLegacyChoices keeps every capability verbatim and shares no array with its input`, `the capability schema refuses an age key`).
  - Also added: `for the same child, Quantity pictures yields only quantity items and Equations only equation items`, `the five Sentence variants differ only in writingMode and canonical length`, `simpler-words maps to the preschool band and all-words to early-primary`.
- `limit-labels.test.ts`: `offers a shorter length only when one really asks for less` becomes `offers a shorter length only when one really fits the capacity` (the remedy now requires the shorter length to fit the capacity, see Files and notes); `retired arms name their deleted code path and are never declared again` is added.
- `options.test.tsx`: `a confidence long Wow on a counting-10 profile is refused before the click` becomes `the D36 Earlier-setting shortfall: a quantities-to-7 long Wow is refused before the click and Standard fills six groups`; `the difficulty remedy appears only when practice really fills the page` becomes `no shortage sentence mentions Difficulty and every remedy names the length or the practice focus`; `a profile stored without earlier settings is explicitly unavailable` becomes `a profile without earlier settings is available and uses the saved defaults`; `Difficulty is session-only and always starts at Practice` becomes `no Difficulty control or stretch wording exists in the panel`. Added: `the D34 Earlier-setting shortfall: Dry Math addition within 1 is refused at every length and scale with the practice-focus remedy only` and `every catalog focus, variant, vocabulary, length and scale is offered exactly when the generator produces it` (Done when 5). The three `stored capabilities Version 1 keeps but never uses` titles are kept; they now assert the earlier-settings disclosure text. `saving stores the parent's raw choices and mutates no child profile` now asserts exactly one `onSaveDefaults` call (Done when 9).
- `web/worksheets/registry.test.ts`: `every declared relevant maximum is one the projector really stretches` becomes `... really carries from the focus`; the two `stretch controls` tests become `worksheet choices in the generator panel > the panel renders no Difficulty or stretch control for any family` and `... > the panel applies each child's earlier settings itself and discloses what it adjusts`; `Make another > a profile without earlier settings is refused before a lifecycle ID or injected generator is called` becomes the same-shape `Make another > seed 0 is refused before a lifecycle ID or injected generator is called` (§4, Done when 5), with `a child without earlier settings is not refused and generates from the defaults` added; `Sentence Builder hides difficulty and the answer key for every writing mode` becomes `Sentence Builder hides the answer key for every writing activity and shows vocabulary/variant as applicable`; `hides difficulty and the answer key and shows length only for bank modes` becomes `hides the answer key and shows length only for bank writing activities`; `a stretch chosen on another family never blocks a family that hides difficulty` becomes `a starving practice focus on another family never blocks a family that hides the focus`; `the activity is unavailable to a profile without quantities` becomes `the activity stays available to a child without quantity settings, at the default focus` (the representation is family-implied). Added: `another family's practice focus, variant or vocabulary never changes a request`, `availability equals generation > every catalog focus, variant, vocabulary, length and scale is offered exactly when it generates` and `... > an Earlier-setting shortfall is refused alike by the control and the generator`. The applicability sweep (title kept) replaces its `difficulty` row with `practiceFocus`, `variant` and `vocabulary` rows.
- `find-the-wow/generator.test.ts`: `locks equation-first, confidence scaffolding, fallback, and unavailable gates` becomes `locks equation-first, fallback, and unavailable gates`; `generates the quantity variant for a dual-capability confidence request` becomes `takes the statement mode only from the Statements variant for the same child`; added `the earlier-settings mapping picks Equations only for a child with the equation gate`.
- `sentence-builder/generator.test.ts`: `every projected request is practice, key-free, and canonical in length` becomes `every projected request is key-free, canonical in length, and carries no difficulty`; added `the Writing activity and Vocabulary alone set the projected mode and band`. `rejects a hand-built request that skipped the canonical normalization` keeps its title; its Difficulty drift case is replaced by a non-canonical length on Draw & Tell.
- `dry-math/generator.test.ts` and `count-compare-make/generator.test.ts` keep every title; a quantities-only (or equations-only) child can no longer be refused at the projection, so the generator refusals are exercised on a projected request whose representation is tampered, with an untampered mirror, and each file adds `a child whose earlier settings lack <equations|quantities> still gets the default <family> focus` (Dry Math also adds `the leaf gate still refuses raw skills without equations or an operation`). No known-vector expected value changed.
- `practice-golden.test.ts`: `the current path generates no cell the grid lacks` becomes `every cell the grid lacks now runs its family at the base focus the earlier settings do not cover` (without profile gates a family the 5c22159 path refused now generates at the default focus; every such cell is asserted uncovered by the record's earlier settings, and every committed key is still generated); `calibration: operandMax minus one changes at least one hash` becomes `calibration: a focus operandMax minus one changes at least one hash` (the perturbation moves the selection's focus).
- `shipped-profile-options.test.ts`: `never offer a selection the generator would reject` keeps its title; its pinned Step 9 confidence refusal is retired with Difficulty, so it now requires the shipped children's earlier settings to starve no cell. Added: the catalog sweep (`every catalog cell is offered exactly when the generator produces it, and none starves`), the D34 and D36 sources, and `mirror: quantities to 8 fill the Long page the D36 source refuses`.

Playwright, 162 before and 162 after:

| File | Before | After | Deleted | Added |
|---|---:|---:|---:|---:|
| `tests/e2e/find-the-wow.spec.ts` | 1 | 1 | 1 | 1 |

`[chromium] › find-the-wow.spec.ts › renders quantity, unavailable, equation, and confidence Wow through the compiled UI` is retitled `[chromium] › find-the-wow.spec.ts › renders quantity, Statements-fallback and equation Wow pages through the compiled UI`, because the unavailable and confidence states it named no longer exist. Every other title is unchanged, including `compiled release profile-to-print and privacy gate` and `compiled 1920×1080 layout: empty first screen fits and no state scrolls horizontally`. No title contains an example id, nickname or interest word.

Removed or changed browser assertions and their named replacement contract tests (Done when 8):

- `options.spec.ts`, `refuses a length the confirmed limits cannot fill before the click` (title kept): the confidence shortfall on the counting-10 child is replaced by the D36 Earlier-setting source on a fictional child built in the spec (quantities to 7): Long is refused with `This practice focus provides 7 unique quantity groups, but this length needs 8. Choose a shorter length under More options, or a practice focus with a wider counting and numerals range.`, and Standard fills and generates six groups; the test also finds no Difficulty control and no stretch wording in the panel. Contract tests: `options.test.tsx` D36 test, `shipped-profile-options.test.ts` D36 test, `limit-labels.test.ts` `PC-insufficient` observed from D36.
- `options.spec.ts`, `a superseded defaults save takes the stale worksheet down with it`: the same Count, Compare & Make shortfall, now reached through an Earlier-setting value, reads `This practice focus provides 0 unique numeral-matching exercises, but this length needs 2. Choose a practice focus with a wider numerals range.`
- `options.spec.ts`, `shows stored capabilities Version 1 keeps but never prints`: the two Step 9 sentences become the one earlier-settings disclosure, asserted verbatim. Contract tests: `earlier-settings.test.ts` (one disclosure per clamp and per flag) and the `options.test.tsx` disclosure describe.
- `find-the-wow.spec.ts`: the status lines (plan's :512, :636, :683) now read `Statements for Two Whats and a Wow: Quantity pictures.` and `... Equations.`; the equations-without-equality child (plan's :630) is no longer refused: it gets the base Quantity pictures variant, Create is enabled and axe stays clean (contract: `earlier-settings.test.ts`, `equations with operations but without equality understanding take the base Wow variant, and Wow stays available`); the confidence block becomes the quantity-only child's quantity page with the quantity oracle at 10 (contract: `project-request.test.ts`, `for the same child, Quantity pictures yields only quantity items and Equations only equation items`). The equation page for the equation-capable child is unchanged.
- `sentence-builder.spec.ts` (plan's :313-317): the status line reads `Writing activity for Sentence Builder: <label>` with the five `SENTENCE_BUILDER_VARIANT_LABELS`, restated in the spec.
- `release-smoke.spec.ts`: the young child's Dry Math refusal (plan's :171-173) becomes a generated Dry Math page at the base focus (`limit-labels.test.ts` declares `DCS-no-equations` and `REG-dry-math-UNAVAIL` dead for the family-implied representation); the equations-only child without equality (plan's :183-197) now generates a Quantity pictures page (`earlier-settings.test.ts`); the confidence case becomes the quantity-only canonical child's quantity page, after asserting that the panel names no Difficulty or stretch.
- `dry-math.spec.ts`: the quantities-only child's Dry Math refusal (plan's :267-269) becomes an enabled Create and a generated 12-problem page. One further assertion outside the plan's list: in `clears generated output across profile selection and profile authority changes`, the check that the same child shows no `This selection creates` line becomes the check that it shows `This selection creates 12 unique problems on one practice page.` (the test's clearing contract is unchanged).
- `count-compare-make.spec.ts`: the equations-only child's refusal (plan's :288) becomes an enabled Create and a generated 8-item page at the base focus (`registry.test.ts`, `the activity stays available to a child without quantity settings, at the default focus`). One further assertion outside the plan's list: the Step 9 text `Version 1 uses at most 20` for the child storing 50 becomes the disclosure `Count, Compare & Make counting: stored 50, using 20.`; the generated quantities are still asserted to stay within 20.
- `accessibility.spec.ts`, `accessibility: unavailable` (plan's :88-91): the state now seeds a fictional version 1 config built in the spec whose child carries the D34 Earlier Dry Math setting (addition within 1), selects that child and asserts Create disabled with `This practice focus provides 3 unique facts, but this length needs N. Choose a practice focus with a wider results range.`; the six tag groups still report zero violations.

### Arm catalogue (Done when 4)

`limit-labels.test.ts` sweeps every registered family over every catalog cell (26 selections: seven Dry Math, two Quantity pictures and five Equations foci, two Count, Compare & Make foci, five writing activities by two vocabularies), every Step 15 probe record rebuilt as earlier settings and mapped through `selectionFromEarlierSettings`, one added probe record (quantities to 5, the only producer of `SL-standard-true` once the shorter-length remedy requires a fill), and the D34 and D36 sources, each at every length and scale. The observed arm set equals the declared reachable set. `RETIRED_ARMS` lists `PC-conf-practice-fills`, `PC-conf-practice-short`, `PC-nonconf` and `FCS-conf-quantity`, each naming its deleted code path. `PC-insufficient` is declared reachable, and the sweep asserts that the D34 and D36 selections themselves reach it. `PS-projection-fail` stays dead with the selection-based reason. Newly declared dead, each for a reason over the whole schema-valid selection domain: `REG-dry-math-UNAVAIL`, `REG-find-the-wow-UNAVAIL`, `REG-count-compare-make-UNAVAIL`, `DCS-no-equations`, `CCS-no-quantities` and `FCS-unavailable` (the family-implied representation and the Statements variant), `DCS-no-operation` (the schema's minimum of one operation and of 1 for both maxima), and `NA-empty` and `FRM-none` (reached only through an unavailable Two Whats and a Wow). The three `*-v1clamp` arms stay dead, now because the schema bounds each quantity focus and the earlier-settings clamp binds a stored value first; the above-ceiling record's closed set pins the ties at the Version 1 ceiling. The digit-normalised sentence shapes are re-declared: 16 shapes, each naming the practice focus or the length.

### Golden comparison (Done when 1, §7 standing check)

`practice-golden.test.ts` reproduces every committed hash through `classifyStoredConfig`, `selectionFromEarlierSettings` over the built-in defaults, and the new projection; the perturbation of a focus `operandMax` still changes hashes. `git diff --exit-code 29808e7 -- frontend/tests/fixtures/golden` exits 0.

`node frontend/scripts/capture-practice-golden.mjs 5c22159 --compare frontend/tests/fixtures/golden/practice-content-keys.json`, run from the repository root by this step's developer: exit 0.

```text
temporary export removed: <TEMP>\extra-credit-golden-uGEO7W
checkout dependencies intact: frontend/node_modules/vitest/package.json
captured 5c22159 (5c2215943cb92222b864736ddf5e90e052fe8bb2)
capture sha256:   49e27e1e8bb5aea0e0f0b17635f20775787351611b3ce84d6415438bc238cb41
committed sha256: 49e27e1e8bb5aea0e0f0b17635f20775787351611b3ce84d6415438bc238cb41
MATCH
```

### Availability equals generation (Done when 5)

`shipped-profile-options.test.ts`, `options.test.tsx` and `web/worksheets/registry.test.ts` each sweep every catalog focus by family, variant, vocabulary, length and scale (156 cells); in every cell the control offers the selection exactly when the real generator produces it, and a refusal's message equals the generator's. The pinned set of starving catalog cells is empty. The two declared Earlier-setting shortfall sources behave as D34 and D36 state: addition within 1 (three facts) is refused at every Dry Math length and scale with the practice-focus remedy only, and quantities to 7 (seven stems) refuse only Long at standard scale, with the shorter-length remedy, while Standard fills six groups.

### Guards (Done when 7 and 10)

`plan-citations.test.ts` and `envelope-single-source.test.ts` pass. The registry comment citing plan line 227 is deleted with `projectPreferences`, and its manifest entry is removed (53 entries to 52); the Sentence Builder `hiddenControlFailure` docblock keeps its plan line 131 citation text and entry. No new reviewed literal site is added: the practice-focus catalog is read from `MATH_PRESETS` and every ceiling is `V1_NUMERIC_MAXIMUM` or `DRY_MATH_NUMERIC_MAXIMUM`. `parent-copy-scan.test.ts` passes, and its calibration fails a synthetic source string containing "review the profile". `config-module-graph.test.ts` asserts that `types.ts` imports from `enums.ts` only through `import type`, calibrated by a synthetic value import. The §7 standing grep over helper-routed control names finds nothing, `foundation.spec.ts` is unchanged, and `tests/e2e/fixtures/worksheet-controls.ts` is unchanged (no helper-routed control changed).

### Files and notes

- Files outside the Files list: `frontend/src/shared/config/defaults.ts` (adds `worksheetSelectionOf`, the defaults' selection without the seeding flag, used by the panel and the fixtures) and `frontend/src/web/profiles/UpgradeNotice.tsx` (its docblock no longer mentions the deleted interim Difficulty select; the notice text is unchanged).
- `CapabilityProfileV1`, `CapabilityProfileV1Schema` and `profileWithLegacyChoices` move from `project-request.ts` to `earlier-settings.ts`: they describe a child's earlier settings, and the projection no longer reads them. `capabilityProfileOf` and `NO_EARLIER_SETTINGS_MESSAGE` are deleted; a profile without `legacyChoices` now starts from the saved defaults.
- The registry contract loses `projectPreferences`: the sole projection boundary already canonicalizes every hidden control, so the per-family normalizer (and the plan line 227 comment on it) had nothing left to do.
- The shorter-length remedy now requires that a shorter length fit the measured capacity (`shorterLengthFills` in `limit-labels.ts`, replacing `shorterLengthLowersRequirement`), because the D34 source must show only the practice-focus remedy at every length (DD15): three facts fill no Dry Math length, although a shorter one asks for fewer.
- Until Step 17 the panel's selection is the saved defaults with the selected child's earlier settings applied to every group they cover, whatever the seeding flag says; its worksheet type starts at the saved default's. The defaults save still writes only the shown layout and personalization fields, passes every worksheet group and `useEarlierChildSettings` through and derives `theme` (D33); `ProfileEditor.test.tsx`'s App-level case now selects a child whose earlier settings differ from the saved defaults in every covered group before saving.
- Every `generatorVersion` stays 1, and every known-vector generator test passes with unchanged expected values. The print fixtures (`matrix.ts`, `count-layout.ts`) build selections from the canonical children's earlier settings and were compared with the base tree over every print fixture and the 240-seed Count, Compare & Make sweep: identical content.
