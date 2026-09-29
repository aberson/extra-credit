import { createHash } from "node:crypto";
import { lstat, readdir, readFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

export const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");

export function safePath(path) {
  return typeof path === "string" && path.length > 0 && !/[\\:]/u.test(path) && [...path].every((char) => char.charCodeAt(0) >= 32)
    && path.split("/").every((part) => part && part !== "." && part !== ".." && !/[. ]$/u.test(part));
}

// Checked before stat, traversal, reading, or hashing an excluded entry.
export function excluded(path) {
  const parts = path.toLowerCase().split("/");
  return parts.some((part) => /^(?:\.git|node_modules|dist|coverage|test-results|playwright-report|\.claude|\.codex|\.agents|\.build-step|\.review-deep|\.ui-review-evidence|downloads?)$/u.test(part)
    || part.startsWith(".env") || part.startsWith(".plan-expedite-state")
    || part.startsWith("children.local.json") || /(?:\.bak|\.tmp)$/u.test(part)
    || part === "extra-credit-profile-backup.json" || /^(?:extra credit worksheet|extra-credit-worksheet).*\.(?:pdf|png)$/u.test(part))
    || (parts[0] === "config" && path !== "config/children.example.json" && parts.length > 1);
}

export async function listTree(root, { exporting = false } = {}) {
  if ((await lstat(root)).isSymbolicLink()) throw new Error("UNSAFE_ROOT");
  const files = [];
  async function walk(prefix) {
    for (const entry of await readdir(join(root, prefix))) {
      const path = prefix ? `${prefix}/${entry}` : entry;
      if (!safePath(path)) throw new Error("UNSAFE_PATH");
      if (excluded(path)) {
        if (exporting) continue;
        throw new Error(`EXCLUDED_PATH: ${path}`);
      }
      const stat = await lstat(join(root, path));
      if (stat.isSymbolicLink()) throw new Error(`UNSAFE_LINK: ${path}`);
      if (stat.isDirectory()) await walk(path);
      else if (stat.isFile()) files.push(path);
      else throw new Error(`UNSAFE_FILE: ${path}`);
    }
  }
  await walk("");
  return files.sort();
}

export async function exportTree(source, destination) {
  const files = await listTree(source, { exporting: true });
  const manifest = [];
  for (const path of files) {
    const bytes = await readFile(join(source, path));
    await mkdir(dirname(join(destination, path)), { recursive: true });
    await writeFile(join(destination, path), bytes, { flag: "wx" });
    manifest.push({ path, sha256: hash(bytes), bytes: bytes.length });
  }
  return manifest;
}
