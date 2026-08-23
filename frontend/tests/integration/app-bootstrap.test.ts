import { once } from "node:events";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { createServer, type Server } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, test } from "vitest";
import { resolveConfig } from "vite";
import { parse as parseYaml } from "yaml";

import {
  assertPrivateBootstrapContext,
  BOOTSTRAP_CONTEXT_ERROR_CODE,
  buildApp,
} from "../../src/server/app.js";
import {
  CANONICAL_CONFIG_PATH,
  classifyStartupFailure,
  PRODUCTION_STATIC_ROOT,
  STARTUP_ERROR_CODES,
  startServer,
  type StartedServer,
} from "../../src/server/startup.js";
import {
  API_PORT,
  LOOPBACK_HOST,
  WEB_PORT,
} from "../../src/shared/runtime/ports.js";

const frontendRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const viteConfigPath = resolve(frontendRoot, "vite.config.ts");
const packagePath = resolve(frontendRoot, "package.json");
const temporaryDirectories: string[] = [];
const startedServers: StartedServer[] = [];
const heldSockets: Server[] = [];

interface PackageMetadata {
  version: string;
}

interface IssueFormOption {
  label?: string;
  required?: boolean;
}

interface IssueFormEntry {
  type?: string;
  id?: string;
  attributes?: {
    value?: string;
    label?: string;
    description?: string;
    placeholder?: string;
    options?: IssueFormOption[];
  };
}

interface IssueForm {
  description?: string;
  body?: IssueFormEntry[];
}

interface IssueTemplateConfig {
  blank_issues_enabled?: boolean;
  contact_links?: Array<{
    name?: string;
    url?: string;
    about?: string;
  }>;
}

function issueFormVisibleText(form: IssueForm): string {
  const text: string[] = [];
  if (form.description !== undefined) {
    text.push(form.description);
  }

  for (const entry of form.body ?? []) {
    const attributes = entry.attributes;
    if (attributes === undefined) {
      continue;
    }
    for (const candidate of [
      attributes.value,
      attributes.label,
      attributes.description,
      attributes.placeholder,
    ]) {
      if (candidate !== undefined) {
        text.push(candidate);
      }
    }
    for (const option of attributes.options ?? []) {
      if (option.label !== undefined) {
        text.push(option.label);
      }
    }
  }

  return text.join("\n");
}

async function readPublicSafetyDocs(): Promise<{
  privacy: string;
  readme: string;
  security: string;
}> {
  const repositoryRoot = resolve(frontendRoot, "..");
  const [readme, privacy, security] = await Promise.all([
    readFile(resolve(repositoryRoot, "README.md"), "utf8"),
    readFile(resolve(repositoryRoot, "PRIVACY.md"), "utf8"),
    readFile(resolve(repositoryRoot, "SECURITY.md"), "utf8"),
  ]);
  return { privacy, readme, security };
}

async function readPackageVersion(): Promise<string> {
  const metadata = JSON.parse(
    await readFile(packagePath, "utf8"),
  ) as Partial<PackageMetadata>;

  if (typeof metadata.version !== "string" || metadata.version.length === 0) {
    throw new Error("Package metadata is missing a version.");
  }

  return metadata.version;
}

async function createTemporaryConfigPath(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "extra-credit-bootstrap-"));
  temporaryDirectories.push(directory);
  return join(directory, "children.local.json");
}

async function holdEphemeralPort(): Promise<{ port: number; server: Server }> {
  const server = createServer();
  server.listen({ host: "127.0.0.1", port: 0, exclusive: true });
  await once(server, "listening");
  const socket = server.address();

  if (socket === null || typeof socket === "string") {
    throw new Error("The port holder did not report a TCP socket.");
  }

  heldSockets.push(server);
  return { port: socket.port, server };
}

async function closeServer(server: Server): Promise<void> {
  await new Promise<void>((resolveClose, reject) => {
    server.close((error) => {
      if (error === undefined) {
        resolveClose();
      } else {
        reject(error);
      }
    });
  });
}

afterEach(async () => {
  await Promise.all(startedServers.splice(0).map(async ({ app }) => app.close()));
  await Promise.all(
    heldSockets.splice(0).map(async (server) => await closeServer(server)),
  );
  await Promise.all(
    temporaryDirectories.splice(0).map(async (directory) => {
      await rm(directory, { force: true, recursive: true });
    }),
  );
});

describe("application bootstrap", () => {
  test("documents local storage, runtime exposure, and data minimization", async () => {
    const { privacy, readme, security } = await readPublicSafetyDocs();

    expect(readme).toMatch(
      /When the server is stopped,[\s\S]*owner-only mode `0600`[\s\S]*Windows relies on the current account's access-control list/iu,
    );
    expect(readme).toMatch(
      /While the server is running, another local process or user[\s\S]*unauthenticated API/iu,
    );
    expect(readme).toMatch(/binds only to `127\.0\.0\.1`/iu);
    expect(readme).toMatch(
      /application runtime sends no profile or worksheet data to a cloud service/iu,
    );
    expect(readme).toMatch(
      /does not ask for surnames, exact birthdates, schools, teachers, email addresses, locations, photos, voices, diagnoses, scores, or behavioral history/iu,
    );
    expect(readme).toMatch(
      /Never forward these ports, and stop the server after use on shared or untrusted computers/iu,
    );

    expect(privacy).toMatch(
      /When Extra Credit is stopped,[\s\S]*owner-only `0600` mode[\s\S]*Windows relies on the current OS account's access-control list/iu,
    );
    expect(privacy).toMatch(
      /While the server is running, any local process or OS user[\s\S]*unauthenticated API/iu,
    );
    expect(privacy).toMatch(
      /binds only to `127\.0\.0\.1`[\s\S]*never forward either port[\s\S]*stop the development or production process after use/iu,
    );
    expect(privacy).toMatch(
      /not a hosted service[\s\S]*no account, cloud sync, analytics, advertising, telemetry/iu,
    );
    expect(privacy).toMatch(
      /profile and worksheet data stay on the local machine and are not sent to the project maintainers or a third party/iu,
    );
    expect(privacy).toMatch(
      /the maintainers do not receive data to retrieve or delete/iu,
    );
    expect(privacy).toMatch(
      /does not request a surname, legal name, exact birthdate, school, teacher, email address, location, photo, voice, diagnosis, score history, or behavioral history/iu,
    );

    expect(security).toMatch(
      /runs locally, binds only to `127\.0\.0\.1`[\s\S]*sends profile data to no cloud service/iu,
    );
    expect(security).toMatch(
      /Never forward ports `4310` or `4311`\. Stop the server after use on a shared or untrusted computer/iu,
    );
    expect(security).toMatch(
      /stopped plaintext config[\s\S]*owner-only mode `0600`[\s\S]*running loopback API is not an OS-account boundary[\s\S]*Any local process or OS user/iu,
    );
  });

  test("documents recovery preservation, residual deletion copies, and private reporting", async () => {
    const { privacy, readme, security } = await readPublicSafetyDocs();

    expect(readme).toMatch(
      /never automatically overwrites an invalid, newer-version, oversized, or unsafe target/iu,
    );
    expect(readme).toMatch(
      /Back up invalid file and replace[\s\S]*bounded regular file with invalid UTF-8, malformed JSON, or an invalid v1 schema[\s\S]*byte-identical exclusive sibling/iu,
    );
    expect(readme).toMatch(
      /Deleting a profile rewrites only the live JSON file[\s\S]*does not delete `.bak` siblings[\s\S]*saved worksheet PDFs\/screenshots, or paper copies/iu,
    );
    expect(readme).toMatch(
      /Deleting a live profile does not remove earlier backups, browser downloads, saved PDFs, screenshots, or printed copies/iu,
    );
    expect(readme).toMatch(
      /does not delete `.bak` siblings[\s\S]*a manually downloaded `extra-credit-profile-backup\.json`/iu,
    );
    expect(readme).toMatch(/save them outside this public repository/iu);

    expect(privacy).toMatch(
      /does not automatically overwrite an unreadable, malformed, schema-invalid, newer-version, oversized, or unsafe target/iu,
    );
    expect(privacy).toMatch(
      /explicit \*\*Back up invalid file and replace\*\* action[\s\S]*byte-identical, exclusive sibling[\s\S]*Newer schema versions are preserved[\s\S]*Oversized, symbolic-link, and other non-regular targets/iu,
    );
    expect(privacy).toMatch(
      /Deleting a profile changes only `config\/children\.local\.json`[\s\S]*does not remove invalid-file `.bak` siblings[\s\S]*saved PDFs[\s\S]*printed pages/iu,
    );
    expect(privacy).toMatch(
      /does not remove invalid-file `.bak` siblings, manually downloaded profile backups, saved PDFs, screenshots, named worksheet copies[\s\S]*or printed pages/iu,
    );
    expect(privacy).toMatch(/save exports outside the repository/iu);

    expect(security).toMatch(
      /Eligible invalid-file recovery is explicit and backup-first\. Future-version, oversized, and unsafe targets are preserved for manual handling/iu,
    );
    expect(security).toMatch(
      /See \[PRIVACY\.md\]\(PRIVACY\.md\) for data minimization, residual-copy cleanup, and recovery details/iu,
    );
    expect(security).toMatch(/Do not open a public issue/iu);
    expect(security).toContain(
      "https://github.com/aberson/extra-credit/security/advisories/new",
    );
  });

  test("keeps issue intake parseable, private-by-default, and child-data safe", async () => {
    const issueRoot = resolve(frontendRoot, "../.github/ISSUE_TEMPLATE");
    const bugSource = await readFile(resolve(issueRoot, "bug_report.yml"), "utf8");
    const configSource = await readFile(resolve(issueRoot, "config.yml"), "utf8");
    const bug = parseYaml(bugSource) as IssueForm;
    const config = parseYaml(configSource) as IssueTemplateConfig;
    const body = bug.body ?? [];
    const visibleText = issueFormVisibleText(bug);
    const privacyCheck = body.find(
      (entry) => entry.type === "checkboxes" && entry.id === "privacy_check",
    );
    const privacyOptions = privacyCheck?.attributes?.options ?? [];

    expect(body.length).toBeGreaterThan(0);
    expect(visibleText).toMatch(/child data/iu);
    expect(visibleText).toMatch(/profiles/iu);
    expect(visibleText).toMatch(/named (?:sheets?|worksheets?)/iu);
    expect(visibleText).toMatch(/secrets/iu);
    expect(visibleText).toMatch(/tokens/iu);
    expect(visibleText).toMatch(/private (?:filesystem )?paths/iu);
    expect(visibleText).toMatch(
      /security vulnerabilities[\s\S]*privately/iu,
    );
    expect(privacyOptions).toHaveLength(2);
    expect(privacyOptions.every(({ required }) => required === true)).toBe(true);
    expect(privacyOptions.map(({ label }) => label).join("\n")).toMatch(
      /child data[\s\S]*profiles[\s\S]*named sheets[\s\S]*secrets[\s\S]*tokens[\s\S]*private paths/iu,
    );
    expect(privacyOptions.map(({ label }) => label).join("\n")).toMatch(
      /security vulnerability[\s\S]*reported privately/iu,
    );
    expect(config.blank_issues_enabled).toBe(false);
    const privateLink = config.contact_links?.find(
      ({ url }) =>
        url ===
        "https://github.com/aberson/extra-credit/security/advisories/new",
    );
    expect(privateLink).toMatchObject({
      name: "Private vulnerability report",
      url: "https://github.com/aberson/extra-credit/security/advisories/new",
    });
    expect(privateLink?.about).toMatch(
      /security issues privately[\s\S]*child data[\s\S]*profiles[\s\S]*named sheets[\s\S]*tokens[\s\S]*secrets[\s\S]*private paths/iu,
    );
    expect(privateLink?.url).toBe(
      "https://github.com/aberson/extra-credit/security/advisories/new",
    );
  });

  test("pins production and Vite authorities to independent literals", async () => {
    expect(LOOPBACK_HOST).toBe("127.0.0.1");
    expect(API_PORT).toBe(4310);
    expect(WEB_PORT).toBe(4311);
    expect(CANONICAL_CONFIG_PATH).toBe(
      resolve(frontendRoot, "../config/children.local.json"),
    );
    expect(PRODUCTION_STATIC_ROOT).toBe(resolve(frontendRoot, "dist/web"));

    const config = await resolveConfig({ configFile: viteConfigPath }, "serve");
    expect(config.server.host).toBe("127.0.0.1");
    expect(config.server.port).toBe(4311);
    expect(config.server.strictPort).toBe(true);
    expect(config.server.fs.deny).toEqual([
      ".env",
      ".env.*",
      "*.{crt,pem,key,p12,pfx,cer,der}",
      ".npmrc",
      ".yarnrc.yml",
      "**/.git/**",
      "config/**",
      "**/config/**",
    ]);
  });

  test("rejects every resolved Vite authority override with one safe code", async () => {
    await expect(
      resolveConfig(
        { configFile: viteConfigPath, server: { host: "0.0.0.0" } },
        "serve",
      ),
    ).rejects.toThrow("EXTRA_CREDIT_VITE_AUTHORITY_ERROR");
    await expect(
      resolveConfig(
        { configFile: viteConfigPath, server: { port: 54_321 } },
        "serve",
      ),
    ).rejects.toThrow("EXTRA_CREDIT_VITE_AUTHORITY_ERROR");
    await expect(
      resolveConfig(
        { configFile: viteConfigPath, server: { strictPort: false } },
        "serve",
      ),
    ).rejects.toThrow("EXTRA_CREDIT_VITE_AUTHORITY_ERROR");
  });

  test("retains an exact frozen private test context without exposing it", async () => {
    const configPath = await createTemporaryConfigPath();
    const packageVersion = await readPackageVersion();
    const app = buildApp({ configPath, securityMode: "ephemeral-test" });
    const fixedApp = buildApp({ configPath, securityMode: "fixed" });

    try {
      assertPrivateBootstrapContext(app, {
        configPath,
        securityMode: "ephemeral-test",
      });
      await app.ready();
      await fixedApp.ready();
      const response = await fixedApp.inject({
        method: "GET",
        url: "/api/health",
        headers: { host: "127.0.0.1:4310" },
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers["cache-control"]).toBe("no-store");
      expect(response.json()).toEqual({ status: "ok", version: packageVersion });
      expect(response.payload).not.toContain(configPath);
      expect(response.payload).not.toContain("ephemeral-test");
    } finally {
      await Promise.all([app.close(), fixedApp.close()]);
    }

    expect(() =>
      buildApp({ configPath: "  ", securityMode: "ephemeral-test" }),
    ).toThrow("EXTRA_CREDIT_BOOTSTRAP_CONTEXT_ERROR");
    expect(() =>
      buildApp({
        configPath: resolve(frontendRoot, "not-a-temporary-config.json"),
        securityMode: "ephemeral-test",
      }),
    ).toThrow(BOOTSTRAP_CONTEXT_ERROR_CODE);
    expect(() =>
      buildApp({
        configPath,
        securityMode: "invalid-runtime-mode" as never,
      }),
    ).toThrow(BOOTSTRAP_CONTEXT_ERROR_CODE);
  });

  test("validates the actual ephemeral loopback socket", async () => {
    const configPath = await createTemporaryConfigPath();
    const started = await startServer({
      configPath,
      host: "127.0.0.1",
      port: 0,
      securityMode: "ephemeral-test",
      staticFiles: { mode: "disabled" },
    });
    startedServers.push(started);
    const socket = started.app.server.address();

    expect(socket).not.toBeNull();
    expect(typeof socket).not.toBe("string");
    if (socket !== null && typeof socket !== "string") {
      expect(socket.address).toBe("127.0.0.1");
      expect(socket.port).toBeGreaterThan(0);
      expect(started.origin).toBe(`http://127.0.0.1:${socket.port}`);
    }
    assertPrivateBootstrapContext(started.app, {
      configPath,
      securityMode: "ephemeral-test",
    });
  });

  test("fails a missing production web build before opening a listener", async () => {
    const configPath = await createTemporaryConfigPath();
    const missingRoot = resolve(frontendRoot, "dist/definitely-missing-web-root");
    const { port, server: portHolder } = await holdEphemeralPort();
    let startupError: unknown;

    try {
      try {
        const unexpectedlyStarted = await startServer({
          configPath,
          host: "127.0.0.1",
          port,
          securityMode: "fixed",
          staticFiles: { mode: "required", root: missingRoot },
        });
        startedServers.push(unexpectedlyStarted);
      } catch (error) {
        startupError = error;
      }

      expect(startupError).toMatchObject({
        code: STARTUP_ERROR_CODES.staticMissing,
      });
      expect(String(startupError)).not.toContain(missingRoot);
    } finally {
      await closeServer(portHolder);
      const holderIndex = heldSockets.indexOf(portHolder);
      if (holderIndex !== -1) {
        heldSockets.splice(holderIndex, 1);
      }
    }
  });

  test("categorizes a real port collision separately from generic failures", async () => {
    const configPath = await createTemporaryConfigPath();
    const { port } = await holdEphemeralPort();
    let startupError: unknown;

    try {
      await startServer({
        configPath,
        host: "127.0.0.1",
        port,
        securityMode: "ephemeral-test",
        staticFiles: { mode: "disabled" },
      });
    } catch (error) {
      startupError = error;
    }

    expect(startupError).toMatchObject({
      code: "EXTRA_CREDIT_PORT_UNAVAILABLE",
    });

    const privateFailure = new Error(
      `private detail: ${configPath} ephemeral-test`,
    );
    const safeFailure = classifyStartupFailure(privateFailure, 4310);
    expect(safeFailure.code).toBe(STARTUP_ERROR_CODES.generic);
    expect(safeFailure.message).toBe(
      "EXTRA_CREDIT_STARTUP_ERROR: The local application could not start.",
    );
    expect(safeFailure.message).not.toContain(configPath);
    expect(safeFailure.message).not.toContain("ephemeral-test");
  });
});
