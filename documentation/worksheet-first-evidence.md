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
