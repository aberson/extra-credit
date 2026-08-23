import {
  useCallback,
  useEffect,
  useReducer,
  useRef,
  useState,
  type CSSProperties,
} from "react";

import {
  HEALTH_ROUTE,
  isHealthResponse,
  type HealthResponse,
} from "../shared/api/health";
import {
  AppConfigV1Schema,
  type AppConfigV1,
  type ChildProfileV1,
} from "../shared/config/schema";
import {
  ConfigApiError,
  ConfigAuthorityChangedError,
  loadConfig,
  saveConfig,
  type ConfigApiErrorCode,
  type LoadedConfig,
} from "./api/client";
import { ProfileEditor } from "./profiles/ProfileEditor";
import { ProfileList } from "./profiles/ProfileList";
import { RecoveryPanel } from "./profiles/RecoveryPanel";

const DOCUMENT_TITLE = "Extra Credit Worksheet";
const HEALTH_REQUEST_TIMEOUT_MS = 500;
const HEALTH_RETRY_DELAYS_MS = [150, 300, 600] as const;

const DEFAULT_CONFIG: AppConfigV1 = {
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

type HealthState =
  | { kind: "checking" }
  | { kind: "ready"; version: string }
  | { kind: "unavailable" };

type ProfileState =
  | { kind: "loading" }
  | { kind: "ready"; config: AppConfigV1; etag?: string; revision: number }
  | {
      kind: "recovery";
      config: AppConfigV1;
      errorCode: ConfigApiErrorCode;
      etag: string;
      message: string;
      revision: number;
    }
  | {
      kind: "blocked";
      errorCode: ConfigApiErrorCode;
      message: string;
    };

interface EditorSession {
  readonly etag?: string;
  readonly profile: ChildProfileV1 | null;
  readonly revision: number;
}

type ProfileReadOutcome =
  | {
      readonly kind: "ready";
      readonly config: AppConfigV1;
      readonly etag?: string;
      readonly source: "loaded" | "missing";
    }
  | {
      readonly kind: "recovery";
      readonly errorCode: ConfigApiErrorCode;
      readonly etag: string;
      readonly message: string;
    }
  | {
      readonly kind: "blocked";
      readonly error: ConfigApiError;
    };

interface ProfileOperation {
  readonly generation: number;
  readonly kind: "mutation" | "read";
}

interface ProfileControllerState {
  readonly editorSession: EditorSession | undefined;
  readonly latestRevision: number;
  readonly operation: ProfileOperation | null;
  readonly profileState: ProfileState;
  readonly recoveryConfirmed: boolean;
  readonly recoveryDraft: AppConfigV1 | undefined;
  readonly successMessage: string | null;
}

type ProfileControllerAction =
  | { readonly type: "begin-operation"; readonly operation: ProfileOperation }
  | {
      readonly type: "adopt-read";
      readonly mode: "replace" | "retain-draft";
      readonly operation: ProfileOperation;
      readonly outcome: ProfileReadOutcome;
    }
  | {
      readonly type: "adopt-write";
      readonly message: string;
      readonly operation: ProfileOperation;
      readonly saved: LoadedConfig;
    }
  | { readonly type: "operation-failed"; readonly operation: ProfileOperation }
  | { readonly type: "open-editor"; readonly session: EditorSession }
  | { readonly type: "close-editor" }
  | {
      readonly type: "set-recovery-confirmed";
      readonly confirmed: boolean;
      readonly revision: number;
    }
  | {
      readonly type: "set-recovery-draft";
      readonly draft: AppConfigV1 | undefined;
    };

const INITIAL_PROFILE_CONTROLLER_STATE: ProfileControllerState = {
  editorSession: undefined,
  latestRevision: 0,
  operation: null,
  profileState: { kind: "loading" },
  recoveryConfirmed: false,
  recoveryDraft: undefined,
  successMessage: null,
};

function operationMatches(
  current: ProfileOperation | null,
  expected: ProfileOperation,
): boolean {
  return (
    current?.generation === expected.generation && current.kind === expected.kind
  );
}

function editorAtRevision(
  editor: Pick<EditorSession, "profile">,
  revision: number,
  etag: string | undefined,
): EditorSession {
  return etag === undefined
    ? { profile: editor.profile, revision }
    : { etag, profile: editor.profile, revision };
}

function profileControllerReducer(
  state: ProfileControllerState,
  action: ProfileControllerAction,
): ProfileControllerState {
  switch (action.type) {
    case "begin-operation":
      return state.operation === null
        ? { ...state, operation: action.operation }
        : state;
    case "operation-failed":
      return operationMatches(state.operation, action.operation)
        ? { ...state, operation: null }
        : state;
    case "adopt-read": {
      if (!operationMatches(state.operation, action.operation)) {
        return state;
      }
      if (action.outcome.kind === "blocked") {
        return {
          ...state,
          editorSession: undefined,
          operation: null,
          profileState: {
            kind: "blocked",
            errorCode: action.outcome.error.code,
            message: action.outcome.error.message,
          },
          recoveryConfirmed: false,
          recoveryDraft: undefined,
          successMessage: null,
        };
      }

      const revision = state.latestRevision + 1;
      const etag = action.outcome.etag;
      const profileState: ProfileState =
        action.outcome.kind === "recovery"
          ? {
              kind: "recovery",
              config: structuredClone(DEFAULT_CONFIG),
              errorCode: action.outcome.errorCode,
              etag: action.outcome.etag,
              message: action.outcome.message,
              revision,
            }
          : {
              kind: "ready",
              config: action.outcome.config,
              ...(etag === undefined ? {} : { etag }),
              revision,
            };
      const editorSession =
        action.mode === "retain-draft"
          ? state.editorSession === undefined
            ? undefined
            : editorAtRevision(state.editorSession, revision, etag)
          : action.outcome.kind === "recovery"
            ? editorAtRevision({ profile: null }, revision, action.outcome.etag)
            : undefined;

      return {
        ...state,
        editorSession,
        latestRevision: revision,
        operation: null,
        profileState,
        recoveryConfirmed: false,
        recoveryDraft:
          action.mode === "retain-draft" && action.outcome.kind === "recovery"
            ? state.recoveryDraft
            : undefined,
        successMessage:
          action.mode === "replace" &&
          action.outcome.kind === "ready" &&
          action.outcome.source === "loaded"
            ? "Saved profiles reloaded from the local file."
            : null,
      };
    }
    case "adopt-write": {
      if (!operationMatches(state.operation, action.operation)) {
        return state;
      }
      const revision = state.latestRevision + 1;
      return {
        ...state,
        editorSession: undefined,
        latestRevision: revision,
        operation: null,
        profileState: {
          kind: "ready",
          config: action.saved.config,
          etag: action.saved.etag,
          revision,
        },
        recoveryConfirmed: false,
        recoveryDraft: undefined,
        successMessage: action.message,
      };
    }
    case "open-editor":
      return state.operation === null &&
        state.profileState.kind === "ready" &&
        action.session.revision === state.profileState.revision &&
        action.session.etag === state.profileState.etag
        ? { ...state, editorSession: action.session, successMessage: null }
        : state;
    case "close-editor":
      return { ...state, editorSession: undefined, recoveryDraft: undefined };
    case "set-recovery-confirmed":
      return state.operation === null &&
        state.profileState.kind === "recovery" &&
        action.revision === state.profileState.revision
        ? { ...state, recoveryConfirmed: action.confirmed }
        : state;
    case "set-recovery-draft":
      return JSON.stringify(state.recoveryDraft) === JSON.stringify(action.draft)
        ? state
        : { ...state, recoveryDraft: action.draft };
  }
}

const shellStyle: CSSProperties = {
  alignItems: "flex-start",
  background:
    "radial-gradient(circle at 12% 14%, rgb(244 190 106 / 38%), transparent 28rem), radial-gradient(circle at 88% 84%, rgb(102 175 171 / 28%), transparent 30rem), #f7f3e8",
  color: "#24324a",
  display: "flex",
  fontFamily: 'Inter, ui-rounded, "Segoe UI", system-ui, sans-serif',
  justifyContent: "center",
  minHeight: "100vh",
  padding: "clamp(1rem, 3vw, 2.5rem)",
};

const cardStyle: CSSProperties = {
  background: "rgb(255 255 255 / 94%)",
  border: "1px solid rgb(36 50 74 / 12%)",
  borderRadius: "1.5rem",
  boxShadow: "0 1.5rem 4rem rgb(64 57 38 / 12%)",
  padding: "clamp(1.25rem, 3vw, 2.5rem)",
  width: "min(100%, 72rem)",
};

const healthBaseStyle: CSSProperties = {
  background: "#fff8e9",
  borderLeft: "0.3rem solid #d3943b",
  borderRadius: "0.3rem 0.9rem 0.9rem 0.3rem",
  padding: "0.7rem 0.9rem",
};

const healthStateStyles: Record<HealthState["kind"], CSSProperties> = {
  checking: {},
  ready: { background: "#edf8f3", borderLeftColor: "#2e7a67" },
  unavailable: { background: "#fff1f0", borderLeftColor: "#b23a3a" },
};

async function waitForRetry(delayMilliseconds: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) {
    throw new DOMException("Health check aborted.", "AbortError");
  }
  await new Promise<void>((resolveWait, reject) => {
    const handleAbort = (): void => {
      window.clearTimeout(timer);
      reject(new DOMException("Health check aborted.", "AbortError"));
    };
    const timer = window.setTimeout(() => {
      signal.removeEventListener("abort", handleAbort);
      resolveWait();
    }, delayMilliseconds);
    signal.addEventListener("abort", handleAbort, { once: true });
  });
}

async function requestHealth(signal: AbortSignal): Promise<HealthResponse> {
  for (let attempt = 0; attempt <= HEALTH_RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      const attemptSignal = AbortSignal.any([
        signal,
        AbortSignal.timeout(HEALTH_REQUEST_TIMEOUT_MS),
      ]);
      const response = await fetch(HEALTH_ROUTE, {
        cache: "no-store",
        headers: { Accept: "application/json" },
        signal: attemptSignal,
      });
      if (!response.ok) {
        throw new Error("Health request failed.");
      }
      const body: unknown = await response.json();
      if (!isHealthResponse(body)) {
        throw new Error("Health response was invalid.");
      }
      return body;
    } catch (error) {
      if (signal.aborted || attempt === HEALTH_RETRY_DELAYS_MS.length) {
        throw error;
      }
      await waitForRetry(HEALTH_RETRY_DELAYS_MS[attempt] ?? 0, signal);
    }
  }
  throw new Error("Health retry budget was exhausted.");
}

function asProfileFailure(error: unknown): ConfigApiError {
  return error instanceof ConfigApiError
    ? error
    : new ConfigApiError(
        "CONFIG_IO_ERROR",
        "The local profile file could not be accessed safely.",
        503,
      );
}

async function readProfileOutcome(): Promise<ProfileReadOutcome> {
  try {
    const loaded = await loadConfig();
    return {
      kind: "ready",
      config: loaded.config,
      etag: loaded.etag,
      source: "loaded",
    };
  } catch (error) {
    const failure = asProfileFailure(error);
    if (failure.code === "CONFIG_NOT_FOUND") {
      return {
        kind: "ready",
        config: structuredClone(DEFAULT_CONFIG),
        source: "missing",
      };
    }
    if (failure.code === "CONFIG_INVALID" && failure.etag !== undefined) {
      return {
        kind: "recovery",
        errorCode: failure.code,
        etag: failure.etag,
        message: failure.message,
      };
    }
    return { kind: "blocked", error: failure };
  }
}

export function App() {
  const [health, setHealth] = useState<HealthState>({ kind: "checking" });
  const [profileController, dispatchProfile] = useReducer(
    profileControllerReducer,
    INITIAL_PROFILE_CONTROLLER_STATE,
  );
  const operationRef = useRef<ProfileOperation | null>(null);
  const nextOperationGenerationRef = useRef(0);
  const {
    editorSession,
    operation,
    profileState,
    recoveryConfirmed,
    recoveryDraft,
    successMessage,
  } = profileController;
  const operationPending = operation !== null;
  const readPending = operation?.kind === "read";

  const beginProfileOperation = useCallback(
    (kind: ProfileOperation["kind"]): ProfileOperation | undefined => {
      if (operationRef.current !== null) {
        return undefined;
      }
      const nextOperation = {
        generation: ++nextOperationGenerationRef.current,
        kind,
      } satisfies ProfileOperation;
      operationRef.current = nextOperation;
      dispatchProfile({ type: "begin-operation", operation: nextOperation });
      return nextOperation;
    },
    [],
  );

  const finishFailedOperation = useCallback(
    (failedOperation: ProfileOperation): void => {
      if (!operationMatches(operationRef.current, failedOperation)) {
        return;
      }
      operationRef.current = null;
      dispatchProfile({ type: "operation-failed", operation: failedOperation });
    },
    [],
  );

  const adoptReadOutcome = useCallback(
    (
      completedOperation: ProfileOperation,
      outcome: ProfileReadOutcome,
      mode: "replace" | "retain-draft",
    ): boolean => {
      if (!operationMatches(operationRef.current, completedOperation)) {
        return false;
      }
      operationRef.current = null;
      dispatchProfile({
        type: "adopt-read",
        mode,
        operation: completedOperation,
        outcome,
      });
      return true;
    },
    [],
  );

  const adoptWriteOutcome = useCallback(
    (
      completedOperation: ProfileOperation,
      saved: LoadedConfig,
      message: string,
    ): boolean => {
      if (!operationMatches(operationRef.current, completedOperation)) {
        return false;
      }
      operationRef.current = null;
      nextOperationGenerationRef.current += 1;
      dispatchProfile({
        type: "adopt-write",
        message,
        operation: completedOperation,
        saved,
      });
      return true;
    },
    [],
  );

  const handleRecoveryDraftChange = useCallback(
    (draft: ChildProfileV1 | undefined): void => {
      dispatchProfile({
        type: "set-recovery-draft",
        draft:
          draft === undefined
            ? undefined
            : { ...structuredClone(DEFAULT_CONFIG), profiles: [draft] },
      });
    },
    [],
  );

  const reloadProfiles = useCallback(async (): Promise<void> => {
    const readOperation = beginProfileOperation("read");
    if (readOperation === undefined) {
      return;
    }
    try {
      adoptReadOutcome(readOperation, await readProfileOutcome(), "replace");
    } catch (error) {
      finishFailedOperation(readOperation);
      throw error;
    }
  }, [adoptReadOutcome, beginProfileOperation, finishFailedOperation]);

  useEffect(() => {
    document.title = DOCUMENT_TITLE;
    const controller = new AbortController();
    async function checkHealth(): Promise<void> {
      try {
        const body = await requestHealth(controller.signal);
        setHealth({ kind: "ready", version: body.version });
        await reloadProfiles();
      } catch (error) {
        if (
          controller.signal.aborted ||
          (error instanceof DOMException && error.name === "AbortError")
        ) {
          return;
        }
        setHealth({ kind: "unavailable" });
      }
    }
    void checkHealth();
    return () => controller.abort();
  }, [reloadProfiles]);

  async function persistProfile(profile: ChildProfileV1): Promise<void> {
    if (profileState.kind !== "ready" && profileState.kind !== "recovery") {
      throw new ConfigApiError("CONFIG_IO_ERROR", "Profiles are not ready to save.", 503);
    }
    if (
      operationRef.current !== null ||
      editorSession === undefined ||
      editorSession.revision !== profileState.revision ||
      editorSession.etag !== profileState.etag
    ) {
      throw new ConfigAuthorityChangedError(
        new ConfigApiError(
          "CONFIG_CONFLICT",
          "Saved profiles changed while this editor was open.",
          409,
        ),
      );
    }
    if (profileState.kind === "recovery" && !recoveryConfirmed) {
      throw new ConfigApiError(
        "CONFIG_RECOVERY_NOT_ALLOWED",
        "Confirm the backup-and-replace recovery action before saving.",
        409,
      );
    }

    const existingIndex = profileState.config.profiles.findIndex(
      (existing) => existing.id === profile.id,
    );
    const profiles = [...profileState.config.profiles];
    if (existingIndex === -1) {
      profiles.push(profile);
    } else {
      profiles[existingIndex] = profile;
    }
    const nextConfig = AppConfigV1Schema.parse({ ...profileState.config, profiles });
    const mutation = beginProfileOperation("mutation");
    if (mutation === undefined) {
      throw new ConfigApiError("CONFIG_IO_ERROR", "Another profile operation is pending.", 409);
    }
    try {
      const saved = await saveConfig(nextConfig, {
        ...(editorSession.etag === undefined ? {} : { etag: editorSession.etag }),
        ...(profileState.kind === "recovery" ? { recoverInvalidFile: true } : {}),
      });
      if (
        !adoptWriteOutcome(
          mutation,
          saved,
          existingIndex === -1 ? "Profile saved locally." : "Profile updated locally.",
        )
      ) {
        throw new ConfigApiError(
          "CONFIG_CONFLICT",
          "A newer profile operation superseded this save.",
          409,
        );
      }
    } catch (error) {
      finishFailedOperation(mutation);
      if (
        error instanceof ConfigApiError &&
        (error.code === "CONFIG_CONFLICT" ||
          error.code === "CONFIG_RECOVERY_NOT_ALLOWED")
      ) {
        throw new ConfigAuthorityChangedError(error);
      }
      throw error;
    }
  }

  async function deleteProfile(profileId: string): Promise<void> {
    if (profileState.kind !== "ready" || operationRef.current !== null) {
      throw new ConfigApiError("CONFIG_IO_ERROR", "Profiles are not ready to change.", 503);
    }
    const nextConfig = AppConfigV1Schema.parse({
      ...profileState.config,
      profiles: profileState.config.profiles.filter(({ id }) => id !== profileId),
    });
    const mutation = beginProfileOperation("mutation");
    if (mutation === undefined) {
      throw new ConfigApiError("CONFIG_IO_ERROR", "Another profile operation is pending.", 409);
    }
    try {
      const saved = await saveConfig(nextConfig, {
        ...(profileState.etag === undefined ? {} : { etag: profileState.etag }),
      });
      if (
        !adoptWriteOutcome(
          mutation,
          saved,
          "Profile deleted from the live local file.",
        )
      ) {
        throw new ConfigApiError(
          "CONFIG_CONFLICT",
          "A newer profile operation superseded this delete.",
          409,
        );
      }
    } catch (error) {
      finishFailedOperation(mutation);
      throw error;
    }
  }

  async function reconcileEditorConflict(): Promise<void> {
    if (
      operationRef.current !== null ||
      editorSession === undefined ||
      (profileState.kind !== "ready" && profileState.kind !== "recovery") ||
      editorSession.revision !== profileState.revision ||
      editorSession.etag !== profileState.etag
    ) {
      throw new ConfigApiError(
        "CONFIG_CONFLICT",
        "The editor revision changed before reconciliation completed.",
        409,
      );
    }

    const readOperation = beginProfileOperation("read");
    if (readOperation === undefined) {
      throw new ConfigApiError("CONFIG_IO_ERROR", "Another profile operation is pending.", 409);
    }
    try {
      const outcome = await readProfileOutcome();
      if (outcome.kind === "blocked") {
        throw outcome.error;
      }
      if (!adoptReadOutcome(readOperation, outcome, "retain-draft")) {
        throw new ConfigApiError(
          "CONFIG_CONFLICT",
          "A newer profile reload superseded this reconciliation.",
          409,
        );
      }
    } catch (error) {
      finishFailedOperation(readOperation);
      throw error;
    }
  }

  const showEditor = editorSession !== undefined;
  const profileConfig =
    profileState.kind === "ready" || profileState.kind === "recovery"
      ? profileState.config
      : undefined;

  return (
    <main className="app-shell" style={shellStyle}>
      <section aria-labelledby="welcome-title" className="welcome-card" style={cardStyle}>
        <header style={{ display: "grid", gap: "0.8rem", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 18rem), 1fr))", marginBottom: "1rem" }}>
          <div>
            <p style={{ color: "#a14d2c", fontSize: "0.78rem", fontWeight: 750, letterSpacing: "0.12em", margin: "0 0 0.4rem", textTransform: "uppercase" }}>
              Parent setup · local worksheet maker
            </p>
            <h1 id="welcome-title" style={{ color: "#17243a", fontSize: "clamp(2rem, 5vw, 3.6rem)", letterSpacing: "-0.045em", lineHeight: 1, margin: 0 }}>
              Extra Credit Worksheet
            </h1>
            <h2 style={{ fontSize: "1.2rem", margin: "0.55rem 0 0" }}>Family profiles</h2>
            <p style={{ color: "#566278", lineHeight: 1.5, margin: "0.7rem 0 0", maxWidth: "40rem" }}>
              Confirm reusable capabilities for thoughtful printable practice while
              keeping family details on this computer.
            </p>
          </div>
          <div className={`health health--${health.kind}`} style={{ ...healthBaseStyle, ...healthStateStyles[health.kind] }}>
            {health.kind !== "unavailable" ? (
              <div aria-atomic="true" role="status">
                {health.kind === "checking" ? (
                  <p>Checking the local server…</p>
                ) : (
                  <>
                    <p style={{ fontWeight: 750, margin: 0 }}>Ready on this computer.</p>
                    <p style={{ color: "#5c6677", fontSize: "0.88rem", margin: "0.2rem 0 0" }}>Version {health.version}</p>
                  </>
                )}
              </div>
            ) : (
              <div role="alert">
                <p style={{ fontWeight: 750, margin: 0 }}>The local server is unavailable.</p>
                <p style={{ color: "#5c6677", fontSize: "0.88rem", margin: "0.2rem 0 0" }}>
                  Stop and restart the Extra Credit development command, then reload this page.
                </p>
              </div>
            )}
          </div>
        </header>

        {health.kind === "ready" && profileState.kind === "loading" && (
          <p aria-live="polite">Loading saved profiles…</p>
        )}
        {health.kind === "ready" && readPending && profileState.kind !== "loading" && (
          <p aria-live="polite" role="status">Reloading saved profiles…</p>
        )}
        {health.kind === "ready" && profileState.kind === "blocked" && (
          <section aria-labelledby="blocked-title">
            <h2 id="blocked-title">Saved profiles could not be opened</h2>
            <p role="alert">{profileState.message}</p>
            <p>
              The file was left unchanged. Stop the app and use the manual
              configuration guidance before retrying; this state cannot be recovered automatically.
            </p>
            <button
              disabled={operationPending}
              onClick={() => {
                if (operationRef.current === null) {
                  void reloadProfiles();
                }
              }}
              type="button"
            >
              Retry reading profiles
            </button>
          </section>
        )}
        {health.kind === "ready" && profileState.kind === "recovery" && (
          <RecoveryPanel
            confirmationDisabled={operationPending}
            confirmed={recoveryConfirmed}
            errorCode={profileState.errorCode}
            message={profileState.message}
            onConfirmedChange={(confirmed) =>
              dispatchProfile({
                type: "set-recovery-confirmed",
                confirmed,
                revision: profileState.revision,
              })
            }
            {...(recoveryDraft === undefined
              ? {}
              : { configForDownload: recoveryDraft })}
          />
        )}

        {health.kind === "ready" && profileConfig !== undefined && (
          <>
            {successMessage !== null && <p role="status">{successMessage}</p>}
            {showEditor ? (
              <ProfileEditor
                key={editorSession?.profile?.id ?? "new-profile"}
                onCancel={() => {
                  if (profileState.kind === "recovery") {
                    dispatchProfile({
                      type: "set-recovery-draft",
                      draft: undefined,
                    });
                  } else {
                    dispatchProfile({ type: "close-editor" });
                  }
                }}
                {...(profileState.kind === "recovery"
                  ? { onDraftChange: handleRecoveryDraftChange }
                  : {})}
                onResolveConflict={reconcileEditorConflict}
                onSubmit={persistProfile}
                operationPending={operationPending}
                {...(editorSession !== undefined && editorSession.profile !== null
                  ? { profile: editorSession.profile }
                  : {})}
                recoveryMode={profileState.kind === "recovery"}
              />
            ) : (
              <>
                <ProfileList
                  key={`profiles-${
                    profileState.kind === "ready" || profileState.kind === "recovery"
                      ? profileState.revision
                      : "unavailable"
                  }`}
                  disabled={operationPending}
                  onAdd={() => {
                    if (operationRef.current !== null || profileState.kind !== "ready") {
                      return;
                    }
                    dispatchProfile({
                      type: "open-editor",
                      session: {
                        ...(profileState.etag === undefined ? {} : { etag: profileState.etag }),
                        profile: null,
                        revision: profileState.revision,
                      },
                    });
                  }}
                  onDelete={deleteProfile}
                  onEdit={(profile) => {
                    if (operationRef.current !== null || profileState.kind !== "ready") {
                      return;
                    }
                    dispatchProfile({
                      type: "open-editor",
                      session: {
                        ...(profileState.etag === undefined ? {} : { etag: profileState.etag }),
                        profile,
                        revision: profileState.revision,
                      },
                    });
                  }}
                  profiles={profileConfig.profiles}
                />
                <div style={{ borderTop: "1px solid #dbe1e8", marginTop: "1rem", paddingTop: "0.8rem" }}>
                  <button
                    disabled={operationPending}
                    onClick={() => {
                      if (operationRef.current === null) {
                        void reloadProfiles();
                      }
                    }}
                    type="button"
                  >
                    {readPending
                      ? "Reloading saved profiles…"
                      : operationPending
                        ? "Saving profile changes…"
                        : "Reload saved profiles"}
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </section>
    </main>
  );
}
