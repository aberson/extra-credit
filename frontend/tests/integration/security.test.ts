import { request as httpRequest } from "node:http";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, test } from "vitest";

import { buildApp } from "../../src/server/app.js";
import {
  startServer,
  type StartedServer,
} from "../../src/server/startup.js";
import type { AppConfigV1 } from "../../src/shared/config/schema.js";

const HOST = "127.0.0.1:4310";
const API_ORIGIN = "http://127.0.0.1:4310";
const WEB_ORIGIN = "http://127.0.0.1:4311";
const temporaryDirectories: string[] = [];
const apps: FastifyInstance[] = [];
const servers: StartedServer[] = [];

function fixture(): AppConfigV1 {
  return {
    schemaVersion: 1,
    profiles: [],
    defaults: {
      useDisplayName: true,
      useInterests: true,
      includeDecorativeGraphics: true,
      difficulty: "practice",
      length: "standard",
      includeAnswerKey: true,
      paperSize: "letter",
      printScale: "standard",
    },
  };
}

async function temporaryConfigPath(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "extra-credit-security-"));
  temporaryDirectories.push(directory);
  return join(directory, "children.local.json");
}

function errorCode(response: { json(): unknown }): string {
  return (response.json() as { error: { code: string } }).error.code;
}

function assertEarlySecurityHeaders(response: {
  headers: Record<string, unknown>;
}): void {
  expect(response.headers["cache-control"]).toBe("no-store");
  expect(response.headers["content-security-policy"]).toContain(
    "object-src 'none'",
  );
  expect(response.headers["content-security-policy"]).toContain(
    "frame-ancestors 'none'",
  );
  expect(response.headers["content-security-policy"]).not.toContain(
    "upgrade-insecure-requests",
  );
  expect(response.headers["referrer-policy"]).toBe("no-referrer");
  expect(response.headers["x-content-type-options"]).toBe("nosniff");
  expect(response.headers["strict-transport-security"]).toBeUndefined();
  expect(response.headers["access-control-allow-origin"]).toBeUndefined();
}

interface RawHttpResponse {
  readonly body: string;
  readonly headers: Record<string, string | string[] | undefined>;
  readonly status: number;
}

async function rawRequest(
  origin: string,
  path: string,
  headers: Record<string, string>,
  method = "GET",
  body?: string,
): Promise<RawHttpResponse> {
  const url = new URL(path, origin);
  return await new Promise((resolveResponse, reject) => {
    const request = httpRequest(
      {
        host: url.hostname,
        port: Number(url.port),
        path: url.pathname,
        method,
        headers: {
          ...headers,
          ...(body === undefined
            ? {}
            : { "content-length": String(Buffer.byteLength(body)) }),
        },
      },
      (response) => {
        const chunks: Buffer[] = [];
        response.on("data", (chunk: Buffer) => chunks.push(chunk));
        response.on("end", () => {
          resolveResponse({
            body: Buffer.concat(chunks).toString("utf8"),
            headers: response.headers,
            status: response.statusCode ?? 0,
          });
        });
      },
    );
    request.on("error", reject);
    if (body !== undefined) {
      request.write(body);
    }
    request.end();
  });
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map(async ({ app }) => app.close()));
  await Promise.all(apps.splice(0).map(async (app) => app.close()));
  await Promise.all(
    temporaryDirectories.splice(0).map(async (directory) => {
      await rm(directory, { force: true, recursive: true });
    }),
  );
});

describe("loopback request security", () => {
  test.each([
    undefined,
    "localhost:4310",
    "127.0.0.1",
    "127.0.0.1:4311",
    "127.0.0.2:4310",
  ])("rejects non-exact Host %s before route logic", async (host) => {
    const configPath = await temporaryConfigPath();
    const app = buildApp({ configPath, securityMode: "fixed" });
    apps.push(app);
    const response = await app.inject({
      method: "GET",
      url: "/api/session",
      headers: {
        ...(host === undefined ? {} : { host }),
        origin: "http://host-canary.invalid",
        "sec-fetch-site": "cross-site",
        "x-forwarded-host": HOST,
      },
    });
    expect(response.statusCode).toBe(403);
    expect(errorCode(response)).toBe("HOST_REJECTED");
    expect(response.payload).not.toContain("host-canary");
    assertEarlySecurityHeaders(response);
  });

  test("orders cross-site and Origin rejection before session-token logic", async () => {
    const app = buildApp({
      configPath: await temporaryConfigPath(),
      securityMode: "fixed",
    });
    apps.push(app);

    const crossSite = await app.inject({
      method: "GET",
      url: "/api/config",
      headers: {
        host: HOST,
        origin: "http://origin-canary.invalid",
        "sec-fetch-site": "cross-site",
      },
    });
    expect(crossSite.statusCode).toBe(403);
    expect(errorCode(crossSite)).toBe("CROSS_SITE_REJECTED");
    assertEarlySecurityHeaders(crossSite);

    const wrongOrigin = await app.inject({
      method: "GET",
      url: "/api/config",
      headers: { host: HOST, origin: "http://127.0.0.1:4312" },
    });
    expect(wrongOrigin.statusCode).toBe(403);
    expect(errorCode(wrongOrigin)).toBe("ORIGIN_REJECTED");
    assertEarlySecurityHeaders(wrongOrigin);

    const multipleOrigins = await app.inject({
      method: "GET",
      url: "/api/session",
      headers: { host: HOST, origin: `${API_ORIGIN}, ${WEB_ORIGIN}` },
    });
    expect(multipleOrigins.statusCode).toBe(403);
    expect(errorCode(multipleOrigins)).toBe("ORIGIN_REJECTED");

    const multipleFetchSites = await app.inject({
      method: "GET",
      url: "/api/session",
      headers: {
        host: HOST,
        "sec-fetch-site": ["same-origin", "cross-site"],
      },
    });
    expect(multipleFetchSites.statusCode).toBe(403);
    expect(errorCode(multipleFetchSites)).toBe("CROSS_SITE_REJECTED");
  });

  test("enforces the missing-Origin session Fetch Metadata exception", async () => {
    const app = buildApp({
      configPath: await temporaryConfigPath(),
      securityMode: "fixed",
    });
    apps.push(app);

    for (const fetchSite of [undefined, "same-origin"] as const) {
      const accepted = await app.inject({
        method: "GET",
        url: "/api/session",
        headers: {
          host: HOST,
          ...(fetchSite === undefined
            ? {}
            : { "sec-fetch-site": fetchSite }),
        },
      });
      expect(accepted.statusCode).toBe(200);
    }

    for (const fetchSite of ["none", "same-site"] as const) {
      const rejected = await app.inject({
        method: "GET",
        url: "/api/session",
        headers: { host: HOST, "sec-fetch-site": fetchSite },
      });
      expect(rejected.statusCode).toBe(403);
      expect(errorCode(rejected)).toBe("ORIGIN_REJECTED");
    }
  });

  test("pins dev and production origins without a wildcard", async () => {
    const configPath = await temporaryConfigPath();
    const development = buildApp({ configPath, securityMode: "fixed" });
    apps.push(development);
    const devResponse = await development.inject({
      method: "GET",
      url: "/api/session",
      headers: { host: HOST, origin: WEB_ORIGIN },
    });
    expect(devResponse.statusCode).toBe(200);

    const staticRoot = join(configPath, "../web");
    await mkdir(staticRoot);
    const production = buildApp({
      configPath,
      securityMode: "fixed",
      staticRoot,
    });
    apps.push(production);
    const prodReject = await production.inject({
      method: "GET",
      url: "/api/session",
      headers: { host: HOST, origin: WEB_ORIGIN },
    });
    expect(prodReject.statusCode).toBe(403);
    expect(errorCode(prodReject)).toBe("ORIGIN_REJECTED");
    const prodAccept = await production.inject({
      method: "GET",
      url: "/api/session",
      headers: { host: HOST, origin: API_ORIGIN },
    });
    expect(prodAccept.statusCode).toBe(200);
  });

  test("uses one 256-bit token per app and rejects stale restart tokens", async () => {
    const configPath = await temporaryConfigPath();
    const randomSizes: number[] = [];
    const first = buildApp({
      configPath,
      securityMode: "fixed",
      sessionRandomBytes: (size) => {
        randomSizes.push(size);
        return Buffer.alloc(size, 0x11);
      },
    });
    apps.push(first);
    const firstSession = await first.inject({
      method: "GET",
      url: "/api/session",
      headers: { host: HOST },
    });
    const repeatedSession = await first.inject({
      method: "GET",
      url: "/api/session",
      headers: { host: HOST },
    });
    const firstToken = (firstSession.json() as { token: string }).token;
    expect(firstToken).toMatch(/^[A-Za-z0-9_-]{43}$/u);
    expect(repeatedSession.json()).toEqual({ token: firstToken });
    expect(randomSizes).toEqual([32]);

    const second = buildApp({
      configPath,
      securityMode: "fixed",
      sessionRandomBytes: (size) => Buffer.alloc(size, 0x22),
    });
    apps.push(second);
    const stale = await second.inject({
      method: "GET",
      url: "/api/config",
      headers: { host: HOST, "x-extra-credit-token": firstToken },
    });
    expect(stale.statusCode).toBe(401);
    expect(errorCode(stale)).toBe("SESSION_TOKEN_INVALID");
    expect(stale.payload).not.toContain(firstToken);
  });

  test("derives one exact authority from a real ephemeral socket", async () => {
    const started = await startServer({
      configPath: await temporaryConfigPath(),
      host: "127.0.0.1",
      port: 0,
      securityMode: "ephemeral-test",
      staticFiles: { mode: "disabled" },
    });
    servers.push(started);
    const authority = started.origin.slice("http://".length);
    const port = Number(authority.split(":")[1]);

    const exact = await rawRequest(started.origin, "/api/session", {
      host: authority,
      origin: started.origin,
    });
    expect(exact.status).toBe(200);
    const token = (JSON.parse(exact.body) as { token: string }).token;

    const wrongHost = await rawRequest(started.origin, "/api/session", {
      host: `127.0.0.1:${port + 1}`,
      origin: started.origin,
    });
    expect(wrongHost.status).toBe(403);
    expect((JSON.parse(wrongHost.body) as { error: { code: string } }).error.code).toBe(
      "HOST_REJECTED",
    );

    const wrongOrigin = await rawRequest(started.origin, "/api/session", {
      host: authority,
      origin: `http://127.0.0.1:${port + 1}`,
    });
    expect(wrongOrigin.status).toBe(403);
    expect(
      (JSON.parse(wrongOrigin.body) as { error: { code: string } }).error.code,
    ).toBe("ORIGIN_REJECTED");

    const body = JSON.stringify(fixture());
    const mutation = await rawRequest(
      started.origin,
      "/api/config",
      {
        host: authority,
        origin: started.origin,
        "content-type": "application/json",
        "if-none-match": "*",
        "x-extra-credit-token": token,
      },
      "PUT",
      body,
    );
    expect(mutation.status).toBe(200);
  });
});
