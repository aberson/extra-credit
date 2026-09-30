import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, writeFile, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { exportTree, hash } from "../../scripts/release-tree.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const owned: string[] = [];
async function fixture() {
  const path = await mkdtemp(join(tmpdir(), "extra-credit-audit-test-"));
  owned.push(path);
  return path;
}
afterEach(async () => { await Promise.all(owned.splice(0).map((path) => rm(path, { recursive: true, force: true }))); });
async function put(room: string, path: string, text: string) {
  await mkdir(dirname(join(room, path)), { recursive: true });
  await writeFile(join(room, path), text);
}
function audit(room: string) {
  const result = spawnSync(process.execPath, [join(root, "frontend/scripts/audit-release.mjs"), room], { encoding: "utf8", windowsHide: true });
  if (result.error) throw result.error;
  return { exit: result.status, output: result.stdout + result.stderr };
}
async function clean() {
  const room = await fixture();
  const manifest = await exportTree(root, room);
  const self = "frontend/tests/integration/release-audit.test.ts";
  expect(manifest.find((entry) => entry.path === self)?.sha256).toBe(hash(await readFile(join(root, self))));
  const result = audit(room);
  expect(result.exit, result.output).toBe(0);
  return room;
}
const remote = () => ["https:", "", "example.invalid", "collect"].join("/");
/** The audit's own record normal form: object keys sorted at every depth. */
const stableJson = (value: unknown): unknown => value && typeof value === "object"
  ? Array.isArray(value)
    ? value.map(stableJson)
    : Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableJson((value as Record<string, unknown>)[key])]))
  : value;
const call = (object: string, method: string) => `${object}.${method}('fixture')`;

describe("public release audit over the current export", () => {
  it("copies current uncommitted bytes and excludes private paths before traversal", async () => {
    const source = await fixture();
    const destination = await fixture();
    await put(source, "new-public.txt", "current bytes");
    for (const path of ["config/children.local.json", "config/children.local.json.invalid.bak", ".env.local", ".git/objects/private", "frontend/node_modules/private", "frontend/dist/private", ".build-step/private", "downloads/private", "extra-credit-profile-backup.json"]) await put(source, path, "excluded");
    const manifest = await exportTree(source, destination);
    expect(manifest).toEqual([{ path: "new-public.txt", sha256: hash("current bytes"), bytes: 13 }]);
    await put(source, "new-public.txt", "changed");
    expect(await exportTree(source, await fixture())).toEqual([{ path: "new-public.txt", sha256: hash("changed"), bytes: 7 }]);
  });

  it("rejects an unexpected linked directory without following it", async () => {
    const source = await fixture();
    await symlink(await fixture(), join(source, "linked"), process.platform === "win32" ? "junction" : "dir");
    await expect(exportTree(source, await fixture())).rejects.toThrow("UNSAFE_LINK");
  });

  it.each<readonly [string, () => string, string, string]>([
    ["private key", () => ["-----BEGIN", "PRIVATE", "KEY-----"].join(" "), "notes.txt", "SECRET_SIGNATURE"],
    ["token", () => ["ghp", "x".repeat(36)].join("_"), "notes.txt", "SECRET_SIGNATURE"],
    ["key assignment", () => ["api", "key"].join("_") + ' = "' + "x".repeat(32) + '"', "notes.txt", "SECRET_SIGNATURE"],
    ["JSON key assignment", () => JSON.stringify({ [["api", "key"].join("_")]: "x".repeat(32) }), "notes.json", "SECRET_SIGNATURE"],
    ...[["localStorage", "setItem"], ["sessionStorage", "setItem"], ["indexedDB", "open"], ["caches", "open"], ["caches", "put"], ["navigator.serviceWorker", "register"]].map(([object, method]) => [`${object} write`, () => call(object!, method!), "frontend/src/web/forbidden.ts", "BROWSER_PERSISTENCE"] as const),
    ...["fetch", "new WebSocket", "new XMLHttpRequest().open"].map((target) => [target, () => `${target}('${remote()}')`, "frontend/src/web/forbidden.ts", "REMOTE_RUNTIME"] as const),
    ["remote asset", () => `<img src="${remote()}">`, "frontend/src/web/forbidden.html", "REMOTE_RUNTIME"],
    ["remote browser entry", () => `<script src="${remote()}"></script>`, "frontend/src/web/index.html", "REMOTE_RUNTIME"],
    ["remote public style", () => `body { background: url(${remote()}); }`, "frontend/src/web/public/forbidden.css", "REMOTE_RUNTIME"],
    ["remote public script", () => `fetch('${remote()}')`, "frontend/src/web/public/forbidden.js", "REMOTE_RUNTIME"],
    ...["frontend/src/web/index.html", "frontend/src/web/public/page.html", "frontend/src/web/public/image.svg"].flatMap((path) => [
      ["inline script in " + path, () => `<script>${call("localStorage", "setItem")}</script>`, path, "EXECUTABLE_MARKUP"],
      ["event handler in " + path, () => `<svg/onload="${call("sessionStorage", "setItem")}"/>`, path, "EXECUTABLE_MARKUP"],
    ] as const),
    ["encoded script URL", () => `<a href="java&#115;cript:${call("caches", "open")}">link</a>`, "frontend/src/web/public/page.html", "EXECUTABLE_MARKUP"],
    ["embedded document", () => `<iframe srcdoc="<script>${call("indexedDB", "open")}</script>"></iframe>`, "frontend/src/web/public/page.html", "EXECUTABLE_MARKUP"],
    ["SVG animated URL", () => `<svg><set attributeName="href" to="javascript:${call("caches", "put")}"/></svg>`, "frontend/src/web/public/image.svg", "EXECUTABLE_MARKUP"],
    ["XML stylesheet", () => '<?xml-stylesheet type="text/xsl" href="local.xsl"?><svg/>', "frontend/src/web/public/image.svg", "EXECUTABLE_MARKUP"],
    ["second entry script", () => '<script type="module" src="/main.tsx"></script>'.repeat(2), "frontend/src/web/index.html", "EXECUTABLE_MARKUP"],
    ...["pdf", "png", "jpg", "jpeg", "webp"].map((ext) => [ext, () => "personalized artifact", `named-sheet.${ext}`, "PERSONALIZED_ARTIFACT"] as const),
  ] as const)("rejects %s after the real test source passes", async (_name, payload, path, code) => {
    const room = await clean();
    await put(room, path, payload());
    const result = audit(room);
    expect(result.exit).toBe(1);
    expect(result.output).toContain(code);
    expect(result.output).not.toContain(payload());
  });

  it.each(["notes.json", "frontend/tests/fixtures/changed.json", "config/children.example.json", "plan.md"])("rejects a serialized profile outside its exact canonical allowance: %s", async (path) => {
    const room = await clean();
    const config = JSON.parse(await readFile(join(room, "config/children.example.json"), "utf8")) as { profiles: Record<string, unknown>[] };
    const profile = { ...config.profiles[0], displayName: "Changed fictional fixture" };
    await put(room, path, JSON.stringify(profile));
    expect(audit(room)).toMatchObject({ exit: 1, output: expect.stringContaining("PROFILE_RECORD") });
  });

  // Version 2 profiles carry no age and may carry `legacyChoices`, so the
  // detector keys on the fields both shapes require: id, reviewedOn, interests.
  const syntheticV2Profile = () => ({
    id: ["0a1b2c3d", "4e5f", "4a6b", "8c7d", "9e0f1a2b3c4d"].join("-"),
    displayName: ["Synthetic", "fictional"].join(" "),
    reviewedOn: "2026-09-29",
    interests: [["tr", "ains"].join("")],
  });
  it.each(["notes.json", "documentation/synthetic-notes.md", "frontend/tests/fixtures/changed.json"])("rejects a runtime-synthesized age-free v2 profile: %s", async (path) => {
    const room = await clean();
    await put(room, path, JSON.stringify(syntheticV2Profile()));
    expect(audit(room)).toMatchObject({ exit: 1, output: expect.stringContaining("PROFILE_RECORD") });
  });

  it("rejects a record nesting legacyChoices outside the allowance", async () => {
    const room = await clean();
    const config = JSON.parse(await readFile(join(room, "frontend/tests/fixtures/config/children.v1.json"), "utf8")) as { profiles: Record<string, unknown>[] };
    const { presentationBand, writingMode, mathSkills, ageYears, ...identity } = config.profiles[1]!;
    expect(mathSkills).toBeDefined();
    void ageYears;
    await put(room, "notes.json", JSON.stringify({ ...identity, legacyChoices: { presentationBand, writingMode, mathSkills } }));
    expect(audit(room)).toMatchObject({ exit: 1, output: expect.stringContaining("PROFILE_RECORD") });
  });

  it("keeps passing the canonical v2 records in the example and the v1 records in the fixture and the plan appendix", async () => {
    const room = await clean();
    for (const path of ["config/children.example.json", "frontend/tests/fixtures/config/children.v1.json", "plan.md"]) {
      const text = await readFile(join(room, path), "utf8");
      expect(text, path).toContain('"reviewedOn"');
      expect(text, path).toContain('"interests"');
    }
    expect(audit(room).exit).toBe(0);
  });

  it("passes the real export with exactly six canonical hashes: three v1 records and three identity-only v2 records", async () => {
    const room = await clean();
    const recordHashes = async (path: string) => {
      const config = JSON.parse(await readFile(join(room, path), "utf8")) as { profiles: unknown[] };
      return config.profiles.map((profile) => hash(JSON.stringify(stableJson(profile))));
    };
    const v1 = await recordHashes("frontend/tests/fixtures/config/children.v1.json");
    const v2 = await recordHashes("config/children.example.json");
    expect(v1).toHaveLength(3);
    expect(v2).toHaveLength(3);
    const expected = [...new Set([...v1, ...v2])].sort();
    expect(expected).toHaveLength(6);
    const source = await readFile(join(root, "frontend/scripts/audit-release.mjs"), "utf8");
    const allowance = /const canonicalProfiles = new Set\(\[([^\]]*)\]\);/u.exec(source)?.[1] ?? "";
    expect([...allowance.matchAll(/"([0-9a-f]{64})"/gu)].map(([, digest]) => digest).sort()).toEqual(expected);
    expect(audit(room).exit).toBe(0);
  });

  it("rejects a README that no longer names the early primary boundary", async () => {
    const room = await clean();
    const readme = await readFile(join(room, "README.md"), "utf8");
    expect(readme).toContain("early primary");
    await put(room, "README.md", readme.replaceAll("early primary", "young learner"));
    const result = audit(room);
    expect(result.exit).toBe(1);
    expect(result.output).toContain("V1_BOUNDARY_DOCS");
  });

  it("allows read-only persistence probes and source links in documentation", async () => {
    const room = await clean();
    await put(room, "frontend/tests/fixtures/probe.ts", call("localStorage", "getItem"));
    await put(room, "source-links.md", remote());
    await put(room, "frontend/src/web/public/local.css", 'body { background: url("http://127.0.0.1:4310/local.svg"); }');
    await put(room, "frontend/src/web/public/local.js", 'new WebSocket("ws://127.0.0.1:4310/local")');
    await put(room, "frontend/src/web/public/local.svg", '<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0 L10 10"/></svg>');
    expect(audit(room).exit).toBe(0);
  });

  it.each(["complete", "notice only", "missing grant", "missing conditions", "missing disclaimer", "unsupported license", "missing attribution"])("verifies upstream MIT terms: %s", async (kind) => {
    const room = await clean();
    const manifestPath = "frontend/src/web/assets/line-art/manifest.json";
    const manifest = JSON.parse(await readFile(join(room, manifestPath), "utf8")) as { assets: Record<string, Record<string, unknown>> };
    const row = Object.values(manifest.assets)[0]!;
    const notice = "Copyright (c) 2026 Fictional Upstream Artist";
    const canonical = await readFile(join(room, "LICENSE"), "utf8");
    const terms = canonical.slice(canonical.indexOf("Permission is hereby granted")).trim();
    const paragraphs = terms.split(/\r?\n\s*\r?\n/u);
    expect(paragraphs).toHaveLength(3);
    let body = terms;
    if (kind === "notice only") body = "";
    if (kind === "missing grant") body = paragraphs.slice(1).join("\n\n");
    if (kind === "missing conditions") body = [paragraphs[0], paragraphs[2]].join("\n\n");
    if (kind === "missing disclaimer") body = paragraphs.slice(0, 2).join("\n\n");
    Object.assign(row, { origin: "third-party", creator: "Fictional Upstream Artist", source: remote(), notice,
      license: kind === "unsupported license" ? "Unverified" : "MIT", licenseFile: "licenses/fictional-MIT.txt" });
    await put(room, manifestPath, JSON.stringify(manifest));
    await put(room, "licenses/fictional-MIT.txt", `MIT License\n\n${notice}\n\n${body}`);
    if (kind !== "missing attribution") await put(room, "ASSET_PROVENANCE.md", await readFile(join(room, "ASSET_PROVENANCE.md"), "utf8") + "\n" + notice);
    const result = audit(room);
    expect(result.exit, result.output).toBe(kind === "complete" ? 0 : 1);
    if (kind !== "complete") expect(result.output).toContain("UPSTREAM_TERMS");
  });

  it.each(["notes.json", "plan.md"])("rejects even canonical records outside the permitted location: %s", async (path) => {
    const room = await clean();
    const config = JSON.parse(await readFile(join(room, "config/children.example.json"), "utf8")) as { profiles: unknown[] };
    const existing = path === "plan.md" ? await readFile(join(room, path), "utf8") : "";
    await put(room, path, existing + "\n" + JSON.stringify(config.profiles[0]));
    expect(audit(room)).toMatchObject({ exit: 1, output: expect.stringContaining("PROFILE_RECORD") });
  });

  it("rejects duplicate profile fields in the permitted appendix", async () => {
    const room = await clean();
    const path = "plan.md";
    const original = await readFile(join(room, path), "utf8");
    const key = JSON.stringify("displayName");
    const field = `${key}: ${JSON.stringify("Riley")}`;
    expect(original).toContain(field);
    await put(room, path, original.replace(field, `${key}: ${JSON.stringify("Other fictional name")}, ${field}`));
    expect(audit(room)).toMatchObject({ exit: 1, output: expect.stringContaining("INVALID_STRUCTURE") });
  });

  it.each(["missing license", "second license", "unmanifested svg", "unmanifested template", "wrong original license", "missing field", "incomplete upstream", "duplicate row", "unsafe asset path", "broken CI"])("rejects %s", async (kind) => {
    const room = await clean();
    const manifestPath = "frontend/src/web/assets/line-art/manifest.json";
    const raw = await readFile(join(room, manifestPath), "utf8");
    const manifest = JSON.parse(raw) as { assets: Record<string, Record<string, unknown>> };
    const path = Object.keys(manifest.assets)[0]!;
    const row = manifest.assets[path]!;
    if (kind === "missing license") await rm(join(room, "LICENSE"));
    else if (kind === "second license") await put(room, "frontend/LICENSE", "different grant");
    else if (kind === "unmanifested svg") await put(room, "frontend/src/web/assets/line-art/nested/new.svg", "<svg/>");
    else if (kind === "unmanifested template") await put(room, "frontend/src/web/assets/templates/new.txt", "worksheet");
    else if (kind === "broken CI") await put(room, ".github/workflows/ci.yml", "jobs: {}\n");
    else {
      if (kind === "wrong original license") row.license = "Other";
      if (kind === "missing field") delete row.creator;
      if (kind === "incomplete upstream") row.origin = "third-party";
      if (kind === "unsafe asset path") { manifest.assets["../outside.svg"] = row; delete manifest.assets[path]; }
      await put(room, manifestPath, kind === "duplicate row" ? raw.replace('"assets": {', `"assets": {${JSON.stringify(path)}: ${JSON.stringify(row)},`) : JSON.stringify(manifest));
    }
    expect(audit(room).exit).toBe(1);
  });
});
