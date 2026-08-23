import {
  AppConfigV1Schema,
  type AppConfigV1,
} from "../../shared/config/schema";

export const CONFIG_API_ERROR_CODES = [
  "BODY_TOO_LARGE",
  "CONFIG_CONFLICT",
  "CONFIG_INVALID",
  "CONFIG_IO_ERROR",
  "CONFIG_NOT_FOUND",
  "CONFIG_PRECONDITION_REQUIRED",
  "CONFIG_RECOVERY_NOT_ALLOWED",
  "CONFIG_SERIALIZED_TOO_LARGE",
  "CONFIG_TOO_LARGE",
  "CONFIG_UNSAFE_FILE",
  "CONFIG_VERSION_UNSUPPORTED",
  "CONTENT_TYPE_REQUIRED",
  "CROSS_SITE_REJECTED",
  "HOST_REJECTED",
  "INVALID_JSON",
  "ORIGIN_REJECTED",
  "SESSION_TOKEN_INVALID",
  "VALIDATION_FAILED",
] as const;

export type ConfigApiErrorCode = (typeof CONFIG_API_ERROR_CODES)[number];

interface ErrorEnvelope {
  readonly error?: {
    readonly code?: unknown;
    readonly message?: unknown;
    readonly fieldErrors?: unknown;
  };
}

export class ConfigApiError extends Error {
  override readonly name: string = "ConfigApiError";

  constructor(
    readonly code: ConfigApiErrorCode,
    message: string,
    readonly status: number,
    readonly etag?: string,
    readonly fieldErrors?: Readonly<Record<string, readonly string[]>>,
  ) {
    super(message);
  }
}

/** Marks a failed mutation whose draft can explicitly adopt fresh read authority. */
export class ConfigAuthorityChangedError extends ConfigApiError {
  override readonly name = "ConfigAuthorityChangedError";

  constructor(failure: ConfigApiError) {
    super(
      failure.code,
      failure.message,
      failure.status,
      failure.etag,
      failure.fieldErrors,
    );
  }
}

export interface LoadedConfig {
  readonly config: AppConfigV1;
  readonly etag: string;
}

export interface SaveConfigOptions {
  readonly etag?: string;
  readonly recoverInvalidFile?: boolean;
}

const CONFIG_ROUTE = "/api/config";
const SESSION_ROUTE = "/api/session";
const KNOWN_ERROR_CODES: ReadonlySet<string> = new Set(CONFIG_API_ERROR_CODES);

let sessionToken: string | undefined;

function responseEtag(response: Response): string | undefined {
  const etag = response.headers.get("etag");
  return etag === null || etag.length === 0 ? undefined : etag;
}

function parseFieldErrors(
  value: unknown,
): Readonly<Record<string, readonly string[]>> | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return undefined;
  }

  const entries = Object.entries(value);
  if (
    entries.some(
      ([, messages]) =>
        !Array.isArray(messages) ||
        messages.some((message) => typeof message !== "string"),
    )
  ) {
    return undefined;
  }

  return Object.fromEntries(
    entries.map(([path, messages]) => [path, messages as string[]]),
  );
}

async function apiFailure(response: Response): Promise<ConfigApiError> {
  let envelope: ErrorEnvelope = {};
  try {
    envelope = (await response.json()) as ErrorEnvelope;
  } catch {
    // The browser receives only the stable fallback below for malformed replies.
  }

  const rawCode = envelope.error?.code;
  const code =
    typeof rawCode === "string" &&
    KNOWN_ERROR_CODES.has(rawCode)
      ? (rawCode as ConfigApiErrorCode)
      : "CONFIG_IO_ERROR";
  const message =
    typeof envelope.error?.message === "string"
      ? envelope.error.message
      : "The local profile file could not be accessed safely.";

  return new ConfigApiError(
    code,
    message,
    response.status,
    responseEtag(response),
    parseFieldErrors(envelope.error?.fieldErrors),
  );
}

async function getSessionToken(forceRefresh = false): Promise<string> {
  if (!forceRefresh && sessionToken !== undefined) {
    return sessionToken;
  }

  const response = await fetch(SESSION_ROUTE, {
    cache: "no-store",
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throw await apiFailure(response);
  }

  const body = (await response.json()) as { readonly token?: unknown };
  if (typeof body.token !== "string" || body.token.length === 0) {
    throw new ConfigApiError(
      "CONFIG_IO_ERROR",
      "The local session could not be started safely.",
      response.status,
    );
  }

  sessionToken = body.token;
  return body.token;
}

async function readWithToken(token: string): Promise<LoadedConfig> {
  const response = await fetch(CONFIG_ROUTE, {
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "X-Extra-Credit-Token": token,
    },
  });
  if (!response.ok) {
    throw await apiFailure(response);
  }

  const body = (await response.json()) as { readonly config?: unknown };
  const parsed = AppConfigV1Schema.safeParse(body.config);
  const etag = responseEtag(response);
  if (!parsed.success || etag === undefined) {
    throw new ConfigApiError(
      "CONFIG_IO_ERROR",
      "The local profile response was invalid.",
      response.status,
    );
  }

  return { config: parsed.data, etag };
}

/** Reads may refresh and retry because they cannot mutate the profile file. */
export async function loadConfig(): Promise<LoadedConfig> {
  const token = await getSessionToken();
  try {
    return await readWithToken(token);
  } catch (error) {
    if (!(error instanceof ConfigApiError) || error.code !== "SESSION_TOKEN_INVALID") {
      throw error;
    }

    sessionToken = undefined;
    return await readWithToken(await getSessionToken(true));
  }
}

/**
 * Mutations are never replayed after a token failure. A fresh token is acquired
 * for the parent's next explicit Save action, while this call still rejects.
 */
export async function saveConfig(
  config: AppConfigV1,
  options: SaveConfigOptions,
): Promise<LoadedConfig> {
  const token = await getSessionToken();
  const response = await fetch(CONFIG_ROUTE, {
    body: JSON.stringify(config),
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(options.etag === undefined
        ? { "If-None-Match": "*" }
        : { "If-Match": options.etag }),
      ...(options.recoverInvalidFile === true
        ? { "X-Extra-Credit-Recovery": "backup-and-replace" }
        : {}),
      "X-Extra-Credit-Token": token,
    },
    method: "PUT",
  });

  if (!response.ok) {
    const failure = await apiFailure(response);
    if (failure.code === "SESSION_TOKEN_INVALID") {
      sessionToken = undefined;
      try {
        await getSessionToken(true);
      } catch {
        sessionToken = undefined;
      }
    }
    throw failure;
  }

  const body = (await response.json()) as { readonly config?: unknown };
  const parsed = AppConfigV1Schema.safeParse(body.config);
  const etag = responseEtag(response);
  if (!parsed.success || etag === undefined) {
    throw new ConfigApiError(
      "CONFIG_IO_ERROR",
      "The saved profile response was invalid.",
      response.status,
    );
  }

  return { config: parsed.data, etag };
}

export function resetSessionForTests(): void {
  sessionToken = undefined;
}
