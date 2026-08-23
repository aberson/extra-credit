import type {
  FastifyPluginAsync,
  FastifyReply,
  FastifyRequest,
} from "fastify";

import {
  AppConfigV1Schema,
} from "../../shared/config/schema.js";
import {
  CONFIG_STORE_ERROR_CODES,
  ConfigStoreFailure,
  type ConfigStore,
} from "../config-store.js";
import {
  APP_CONFIG_TRANSPORT_SCHEMA,
  apiError,
  zodFieldErrors,
  type PublicErrorCode,
} from "../transport-schemas.js";

export interface ConfigRouteOptions {
  readonly requireSessionToken: (
    request: FastifyRequest,
    reply: FastifyReply,
  ) => Promise<FastifyReply | void>;
  readonly store: ConfigStore;
}

const storeErrorResponses = {
  [CONFIG_STORE_ERROR_CODES.conflict]: {
    code: "CONFIG_CONFLICT",
    status: 409,
  },
  [CONFIG_STORE_ERROR_CODES.invalid]: {
    code: "CONFIG_INVALID",
    status: 409,
  },
  [CONFIG_STORE_ERROR_CODES.io]: { code: "CONFIG_IO_ERROR", status: 503 },
  [CONFIG_STORE_ERROR_CODES.notFound]: {
    code: "CONFIG_NOT_FOUND",
    status: 404,
  },
  [CONFIG_STORE_ERROR_CODES.preconditionRequired]: {
    code: "CONFIG_PRECONDITION_REQUIRED",
    status: 428,
  },
  [CONFIG_STORE_ERROR_CODES.recoveryNotAllowed]: {
    code: "CONFIG_RECOVERY_NOT_ALLOWED",
    status: 409,
  },
  [CONFIG_STORE_ERROR_CODES.serializedTooLarge]: {
    code: "CONFIG_SERIALIZED_TOO_LARGE",
    status: 413,
  },
  [CONFIG_STORE_ERROR_CODES.tooLarge]: {
    code: "CONFIG_TOO_LARGE",
    status: 409,
  },
  [CONFIG_STORE_ERROR_CODES.unsafeFile]: {
    code: "CONFIG_UNSAFE_FILE",
    status: 409,
  },
  [CONFIG_STORE_ERROR_CODES.versionUnsupported]: {
    code: "CONFIG_VERSION_UNSUPPORTED",
    status: 409,
  },
} as const satisfies Record<
  string,
  { readonly code: PublicErrorCode; readonly status: number }
>;

function oneHeader(value: string | readonly string[] | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}

async function requireJsonContentType(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<FastifyReply | void> {
  const contentType = oneHeader(request.headers["content-type"]);
  const mediaType = contentType?.split(";", 1)[0]?.trim().toLowerCase();
  if (mediaType !== "application/json") {
    await reply.code(415).send(apiError("CONTENT_TYPE_REQUIRED"));
    return reply;
  }
}

async function sendStoreFailure(
  failure: unknown,
  reply: FastifyReply,
): Promise<void> {
  const safeFailure =
    failure instanceof ConfigStoreFailure
      ? failure
      : new ConfigStoreFailure(CONFIG_STORE_ERROR_CODES.io);
  const response = storeErrorResponses[safeFailure.code];
  if (safeFailure.etag !== undefined) {
    reply.header("ETag", safeFailure.etag);
  }
  await reply.code(response.status).send(apiError(response.code));
}

export const configRoutes: FastifyPluginAsync<ConfigRouteOptions> = async (
  app,
  options,
) => {
  app.get(
    "/api/config",
    { onRequest: options.requireSessionToken },
    async (_request, reply) => {
      try {
        const stored = await options.store.load();
        reply.header("ETag", stored.etag);
        return { config: stored.config };
      } catch (error) {
        await sendStoreFailure(error, reply);
        return reply;
      }
    },
  );

  app.put<{ Body: unknown }>(
    "/api/config",
    {
      onRequest: [options.requireSessionToken, requireJsonContentType],
      schema: { body: APP_CONFIG_TRANSPORT_SCHEMA },
    },
    async (request, reply) => {
      const validated = AppConfigV1Schema.safeParse(request.body);
      if (!validated.success) {
        await reply
          .code(422)
          .send(apiError("VALIDATION_FAILED", zodFieldErrors(validated.error.issues)));
        return reply;
      }

      try {
        const ifMatch = oneHeader(request.headers["if-match"]);
        const ifNoneMatch = oneHeader(request.headers["if-none-match"]);
        const recovery = oneHeader(
          request.headers["x-extra-credit-recovery"],
        );
        const stored = await options.store.save(validated.data, {
          ...(ifMatch === undefined ? {} : { ifMatch }),
          ...(ifNoneMatch === undefined ? {} : { ifNoneMatch }),
          ...(recovery === undefined ? {} : { recovery }),
        });
        reply.header("ETag", stored.etag);
        return { config: stored.config };
      } catch (error) {
        await sendStoreFailure(error, reply);
        return reply;
      }
    },
  );
};
