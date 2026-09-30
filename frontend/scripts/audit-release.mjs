import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { parseDocument } from "yaml";
import { hash, listTree, safePath } from "./release-tree.mjs";

// Whole-record hashes of the three canonical fictional children: first as
// version 1 records (the v1 fixture and the plan appendix), then as the
// identity-only version 2 records of the committed example.
const canonicalProfiles = new Set([
  "078bc73b70f818c22573205617b414884f0d7090d400af31ffe7528cf9d99a10",
  "2bda83030410b45182eaa1f64b2454498ae68236f8eedbe5afd60571d9dcee7f",
  "7726ad9bec6455bf37c2bc01e71e321df68c7093c986f5c774c490429c7637a1",
  "fa95f0e27e978dda3ec4ce67bf45af8edee2c3ae14d6184fbeebbed3519440f6",
  "6cf25facf737f27f383b490f481c06ea419b5a103ef58181fdac1a520ab4da6f",
  "539f07d138efbbe430bb33b7d475e14d5831090ab4d6d172aacbce00a416c46f",
]);
const stable = (v) => v && typeof v === "object" ? Array.isArray(v) ? v.map(stable)
  : Object.fromEntries(Object.keys(v).sort().map((k) => [k, stable(v[k])])) : v;
// The keys every version 1 and version 2 profile must carry, so a record of
// either shape is detected; a strict subset of the seven v1 keys.
const profileFields = ["id", "reviewedOn", "interests"];
const nonempty = (value) => typeof value === "string" && value.trim().length > 0;
const fail = (code, path) => { throw new Error(`${code}: ${path}`); };

function loopbackTarget(value) {
  try {
    const url = new URL(value.startsWith("//") ? `http:${value}` : value);
    return ["http:", "https:", "ws:", "wss:"].includes(url.protocol)
      && ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) && !url.username && !url.password;
  } catch { return false; }
}

function structured(text, path) {
  const doc = parseDocument(text, { uniqueKeys: true });
  if (doc.errors.length) fail("INVALID_STRUCTURE", path);
  return doc.toJS();
}

// Scan balanced JSON objects in prose as well as entire JSON documents. Quoted
// braces and escapes do not delimit records. No payload is printed on failure.
function jsonObjects(text) {
  const results = [];
  const stack = [];
  let quoted = false;
  let escape = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (escape) { escape = false; continue; }
    if (quoted && c === "\\") { escape = true; continue; }
    if (stack.length && c === '"') { quoted = !quoted; continue; }
    if (quoted) continue;
    if (c === "{") stack.push(i);
    if (c === "}" && stack.length) {
      const start = stack.pop();
      const raw = text.slice(start, i + 1);
      try { results.push({ value: JSON.parse(raw), raw, start }); } catch { /* Not JSON. */ }
    }
  }
  return results;
}

function inspectProfiles(text, path) {
  const appendix = path === "plan.md" ? /### 12\.1[^]*?```json\s*([^]*?)```/u.exec(text) : null;
  const start = appendix ? text.indexOf(appendix[1], appendix.index) : -1;
  for (const { value, raw, start: offset } of jsonObjects(text)) {
    if (!value || !profileFields.every((key) => Object.hasOwn(value, key))) continue;
    structured(raw, path);
    const allowed = path === "config/children.example.json" || path.startsWith("frontend/tests/fixtures/")
      || (start >= 0 && offset >= start && offset < start + appendix[1].length);
    if (!allowed || !canonicalProfiles.has(hash(JSON.stringify(stable(value))))) fail("PROFILE_RECORD", path);
  }
  if (/\.(?:json|ya?ml)$/u.test(path)) {
    const visit = (value) => {
      if (!value || typeof value !== "object") return;
      if (profileFields.every((key) => Object.hasOwn(value, key))
        && (!(path === "config/children.example.json" || path.startsWith("frontend/tests/fixtures/"))
          || !canonicalProfiles.has(hash(JSON.stringify(stable(value)))))) fail("PROFILE_RECORD", path);
      for (const child of Object.values(value)) visit(child);
    };
    visit(structured(text, path));
  }
}

function inspectRuntime(text, path) {
  // Vite's root is src/web, including its index.html and default public/ tree.
  if (!path.startsWith("frontend/src/") || /\.test\.[cm]?[jt]sx?$/u.test(path)) return;
  const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  function visit(node) {
    if (ts.isCallExpression(node)) {
      const target = node.expression.getText(source).replace(/\s/gu, "").replace(/\[['"]([\w]+)['"]\]/gu, ".$1");
      if (/(?:localStorage|sessionStorage)\.setItem$|indexedDB\.open$|caches\.(?:open|put|add|addAll)$|serviceWorker\.register$/u.test(target)) fail("BROWSER_PERSISTENCE", path);
    }
    // External executable string URLs are disallowed regardless of domain.
    // Source-link exceptions are comments, documentation and provenance JSON;
    // the JSON-schema identifier and SVG namespace are non-runtime metadata.
    if (ts.isStringLiteralLike(node) && /^(?:https?:|wss?:)?\/\//iu.test(node.text)) {
      if (!loopbackTarget(node.text)
        && !(path === "frontend/src/server/transport-schemas.ts" && ts.isPropertyAssignment(node.parent)
          && node.parent.name.getText(source) === "$schema" && node.text === "http://json-schema.org/draft-07/schema#")) fail("REMOTE_RUNTIME", path);
    }
    if (ts.isTemplateExpression(node) && /^(?:https?:|wss?:)?\/\//iu.test(node.head.text)) {
      const localPort = path === "frontend/src/shared/runtime/ports.ts" && /^`http:\/\/\$\{LOOPBACK_HOST\}:\$\{(?:API|WEB)_PORT\}`$/u.test(node.getText(source));
      const localAuthority = path === "frontend/src/server/security.ts" && node.getText(source) === "`http://${authority}`";
      if (!localPort && !localAuthority && !/^http:\/\/127\.0\.0\.1:/u.test(node.head.text)) fail("REMOTE_RUNTIME", path);
    }
    ts.forEachChild(node, visit);
  }
  if (/\.[cm]?[jt]sx?$/u.test(path)) visit(source);
  if (/\.(?:svg|css|html?|xhtml|xml)$/iu.test(path)) {
    const scrubbed = text.replace(/\sxmlns(?::[\w-]+)?=["']http:\/\/www\.w3\.org\/2000\/svg["']/gu, "");
    for (const match of scrubbed.matchAll(/(?:https?:|wss?:)?\/\/[^\s"'<>)}]+/giu)) {
      if (!loopbackTarget(match[0])) fail("REMOTE_RUNTIME", path);
    }
  }
  if (/\.(?:svg|html?|xhtml|xml)$/iu.test(path)) {
    // No HTML/XML parser is part of this gate. Fail closed on executable markup,
    // including entity-encoded attributes and embedded documents. Only Vite's
    // fixed external entry is allowed; its actual TSX source is audited above.
    const markup = path === "frontend/src/web/index.html"
      ? text.replace('<script type="module" src="/main.tsx"></script>', "") : text;
    if (markup.includes("&") || markup.includes("\0")
      || /<\?|<!\s*(?:ENTITY|DOCTYPE\s+(?!html\s*>))/iu.test(markup)
      || /<\s*(?:[\w-]+:)?(?:script|iframe|frame|object|embed|foreignObject|animate\w*|set|handler)\b/iu.test(markup)
      || /[\s/]on[\w:-]+\s*=/iu.test(markup)
      || /\b(?:srcdoc|http-equiv)\s*=/iu.test(markup)
      || /(?:javascript|vbscript|data)\s*:/iu.test([...markup].filter((char) => char.charCodeAt(0) > 32).join(""))) fail("EXECUTABLE_MARKUP", path);
  }
}

export async function auditRelease(root) {
  const paths = await listTree(root);
  const contents = new Map();
  for (const path of paths) {
    if (/\.(?:pdf|png|jpe?g|webp)$/iu.test(path)) fail("PERSONALIZED_ARTIFACT", path);
    const text = await readFile(resolve(root, path), "utf8");
    contents.set(path, text);
    if (/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,}|sk-[A-Za-z0-9_-]{20,}|AKIA[A-Z0-9]{16})\b|\b(?:api[_-]?key|access[_-]?token|secret[_-]?key)["']?\s*[=:]\s*["'][A-Za-z0-9_+/-]{16,}["']/iu.test(text)) fail("SECRET_SIGNATURE", path);
    inspectProfiles(text, path);
    inspectRuntime(text, path);
  }
  const get = (path) => contents.get(path) ?? fail("MISSING_FILE", path);
  const license = get("LICENSE").replace(/\s+/gu, " ").trim();
  if (hash(license) !== "55e083e3f8a45e2b90d671a8cb9b0db1542ccfd30bc99ad6f4d1e9787b0f5b01") fail("ROOT_LICENSE", "LICENSE");
  const mitTerms = license.slice(license.indexOf("Permission is hereby granted"));
  const pkg = structured(get("frontend/package.json"), "frontend/package.json");
  if (pkg.license !== "MIT") fail("PACKAGE_LICENSE", "frontend/package.json");
  for (const path of ["README.md", "CONTRIBUTING.md"]) {
    const text = get(path);
    if (!["project-original", "code", "worksheet templates", "documentation", "line art", "LICENSE", "MIT", "upstream"].every((word) => text.includes(word))) fail("LICENSE_DOCS", path);
  }
  for (const path of ["README.md", "PRIVACY.md", "SECURITY.md"]) {
    if (!["127.0.0.1", "4310", "4311", "children.local.json", "local process", "backup"].every((word) => get(path).includes(word))) fail("BOUNDARY_DOCS", path);
  }
  if (!["CONTRIBUTING.md", "ASSET_PROVENANCE.md"].every((path) => get("README.md").includes(`](${path})`))) fail("DOC_LINKS", "README.md");
  for (const term of ["early primary", "within 20", "no accounts", "cloud services", "telemetry", "runtime AI", "no scheduler", "backups", "saved PDFs"]) {
    if (!get("README.md").includes(term)) fail("V1_BOUNDARY_DOCS", "README.md");
  }
  const manifestPath = "frontend/src/web/assets/line-art/manifest.json";
  const manifest = structured(get(manifestPath), manifestPath);
  if (manifest.schemaVersion !== 1 || !manifest.assets || Array.isArray(manifest.assets)) fail("ASSET_MANIFEST", manifestPath);
  const isAsset = (path) => /^frontend\/src\/web\/assets\/line-art\/.+\.svg$/u.test(path)
    || (path.startsWith("frontend/src/web/assets/templates/") && !/\.[cm]?[jt]sx?$/u.test(path));
  const ids = new Set();
  const upstreamLicenses = new Set();
  for (const [path, row] of Object.entries(manifest.assets)) {
    if (!safePath(path) || !isAsset(path) || !contents.has(path) || !row || typeof row !== "object") fail("ASSET_PATH", manifestPath);
    if (!["id", "description", "creator", "source", "reviewedOn", "aiAssistance", "license", "licenseFile"].every((field) => nonempty(row[field]))
      || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(row.id) || ids.has(row.id)
      || !Array.isArray(row.topics) || !row.topics.length || new Set(row.topics).size !== row.topics.length
      || !row.topics.every((topic) => ["animals", "nature", "neutral", "space", "sports", "vehicles"].includes(topic))
      || !/^\d{4}-\d{2}-\d{2}$/u.test(row.reviewedOn) || !Number.isFinite(Date.parse(row.reviewedOn))
      || new Date(row.reviewedOn).toISOString().slice(0, 10) !== row.reviewedOn) fail("ASSET_PROVENANCE", path);
    ids.add(row.id);
    if (row.origin === "original") {
      if (row.license !== "MIT" || row.licenseFile !== "LICENSE") fail("ORIGINAL_LICENSE", path);
    } else if (row.origin === "third-party") {
      if (!/^https:\/\/[^\s]+$/u.test(row.source) || !nonempty(row.notice) || !safePath(row.licenseFile)
        || row.licenseFile === "LICENSE" || !nonempty(contents.get(row.licenseFile))
        || !get(row.licenseFile).includes(row.notice) || !get("ASSET_PROVENANCE.md").includes(row.notice)) fail("UPSTREAM_TERMS", path);
      // Support the canonical MIT grant, conditions and disclaimer, with the
      // upstream's own notice. Other licenses/variants need explicit verification.
      const upstream = get(row.licenseFile).replace(/\s+/gu, " ").trim();
      const notice = row.notice.replace(/\s+/gu, " ").trim();
      if (row.license !== "MIT" || !/^Copyright\b/iu.test(notice)
        || ![`${notice} ${mitTerms}`, `MIT License ${notice} ${mitTerms}`].includes(upstream)) fail("UPSTREAM_TERMS", path);
      upstreamLicenses.add(row.licenseFile);
    } else fail("ASSET_ORIGIN", path);
  }
  for (const path of paths) {
    if (isAsset(path) && !Object.hasOwn(manifest.assets, path)) fail("UNMANIFESTED_ASSET", path);
    if (/(?:^|\/)(?:licen[cs]e|copying)(?:[.-][^/]*)?$/iu.test(path) && path !== "LICENSE" && !upstreamLicenses.has(path)) fail("SECOND_LICENSE", path);
  }
  const workflow = structured(get(".github/workflows/ci.yml"), ".github/workflows/ci.yml");
  const quality = workflow.jobs?.quality;
  const steps = quality?.steps ?? [];
  if (workflow.on?.push !== null || workflow.on?.pull_request !== null || workflow.defaults?.run?.["working-directory"] !== "frontend"
    || quality?.["runs-on"] !== "ubuntu-24.04" || quality.if || quality["continue-on-error"]
    || steps.some((step) => step.if || step["continue-on-error"])
    || !steps.some((step) => step.uses === "actions/checkout@v4" && step.with?.["persist-credentials"] === false)
    || !steps.some((step) => step.uses === "actions/setup-node@v4" && step.with?.["node-version-file"] === ".node-version" && step.with?.["cache-dependency-path"] === "frontend/package-lock.json")
    || JSON.stringify(steps.filter((step) => step.run).map((step) => step.run)) !== JSON.stringify(["npm ci", "npx playwright install --with-deps chromium", "npm run check"])
    || pkg.scripts.check !== "npm run lint && npm run typecheck && npm test && npm run test:e2e && npm run test:log-privacy"
    || pkg.scripts["test:e2e"] !== "npm run build && node tests/e2e/server-harness.mjs"
    || pkg.scripts["test:log-privacy"] !== "node tests/e2e/log-privacy-calibration.mjs") fail("CI_CONTRACT", ".github/workflows/ci.yml");
  return { files: paths.length, assets: ids.size, status: "PASS" };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (!process.argv[2]) throw new Error("USAGE: node audit-release.mjs <export-root>");
    console.log(JSON.stringify(await auditRelease(resolve(process.argv[2]))));
  }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
