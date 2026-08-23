import {
  randomBytes as nodeRandomBytes,
  timingSafeEqual,
} from "node:crypto";

import type {
  FastifyInstance,
  FastifyReply,
  FastifyRequest,
} from "fastify";

import {
  API_PORT,
  API_ORIGIN,
  LOOPBACK_HOST,
  WEB_ORIGIN,
} from "../shared/runtime/ports.js";
import { apiError } from "./transport-schemas.js";

export type SecurityMode = "ephemeral-test" | "fixed";

export interface SecurityBoundaryOptions {
  readonly allowDevelopmentOrigin: boolean;
  readonly mode: SecurityMode;
  readonly randomBytes?: (size: number) => Buffer;
}

export interface SecurityBoundary {
  readonly sessionToken: string;
  requireSessionToken(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<FastifyReply | void>;
}

function oneHeader(value: string | readonly string[] | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function isMultipleHeader(value: string | readonly string[] | undefined): boolean {
  return Array.isArray(value);
}

function expectedAuthority(
  request: FastifyRequest,
  mode: SecurityMode,
): string | undefined {
  if (mode === "fixed") {
    return `${LOOPBACK_HOST}:${API_PORT}`;
  }

  const port = request.raw.socket.localPort;
  return typeof port === "number" && Number.isInteger(port) && port > 0
    ? `${LOOPBACK_HOST}:${port}`
    : undefined;
}

function isMutation(request: FastifyRequest): boolean {
  return !["GET", "HEAD", "OPTIONS"].includes(request.method);
}

function tokensMatch(expected: string, actual: string | undefined): boolean {
  if (actual === undefined) {
    return false;
  }
  const expectedBytes = Buffer.from(expected);
  const actualBytes = Buffer.from(actual);
  return (
    expectedBytes.byteLength === actualBytes.byteLength &&
    timingSafeEqual(expectedBytes, actualBytes)
  );
}

export function registerSecurityBoundary(
  app: FastifyInstance,
  options: SecurityBoundaryOptions,
): SecurityBoundary {
  const tokenBytes = (options.randomBytes ?? nodeRandomBytes)(32);
  if (tokenBytes.byteLength !== 32) {
    throw new Error("The local session token source failed safely.");
  }
  const token = tokenBytes.toString("base64url");

  app.addHook("onRequest", async (request, reply) => {
    if (!request.url.startsWith("/api/")) {
      return;
    }

    const authority = expectedAuthority(request, options.mode);
    if (authority === undefined || oneHeader(request.headers.host) !== authority) {
      await reply.code(403).send(apiError("HOST_REJECTED"));
      return reply;
    }

    const rawFetchSite = request.headers["sec-fetch-site"];
    if (isMultipleHeader(rawFetchSite)) {
      await reply.code(403).send(apiError("CROSS_SITE_REJECTED"));
      return reply;
    }
    const fetchSite = oneHeader(rawFetchSite)?.toLowerCase();
    if (
      fetchSite !== undefined &&
      !["cross-site", "none", "same-origin", "same-site"].includes(fetchSite)
    ) {
      await reply.code(403).send(apiError("CROSS_SITE_REJECTED"));
      return reply;
    }
    if (fetchSite === "cross-site") {
      await reply.code(403).send(apiError("CROSS_SITE_REJECTED"));
      return reply;
    }

    const rawOrigin = request.headers.origin;
    if (isMultipleHeader(rawOrigin)) {
      await reply.code(403).send(apiError("ORIGIN_REJECTED"));
      return reply;
    }
    const origin = oneHeader(rawOrigin);
    const allowedOrigins =
      options.mode === "ephemeral-test"
        ? new Set([`http://${authority}`])
        : new Set([
            API_ORIGIN,
            ...(options.allowDevelopmentOrigin ? [WEB_ORIGIN] : []),
          ]);

    if (origin !== undefined && !allowedOrigins.has(origin)) {
      await reply.code(403).send(apiError("ORIGIN_REJECTED"));
      return reply;
    }

    if (isMutation(request) && origin === undefined) {
      await reply.code(403).send(apiError("ORIGIN_REJECTED"));
      return reply;
    }

    if (
      request.method === "GET" &&
      request.url.split("?", 1)[0] === "/api/session" &&
      origin === undefined &&
      fetchSite !== undefined &&
      fetchSite !== "same-origin"
    ) {
      await reply.code(403).send(apiError("ORIGIN_REJECTED"));
      return reply;
    }
  });

  return {
    sessionToken: token,
    async requireSessionToken(request, reply) {
      const presented = oneHeader(request.headers["x-extra-credit-token"]);
      if (!tokensMatch(token, presented)) {
        await reply.code(401).send(apiError("SESSION_TOKEN_INVALID"));
        return reply;
      }
    },
  };
}
