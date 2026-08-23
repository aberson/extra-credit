import { type CSSProperties, useEffect, useState } from "react";

import {
  HEALTH_ROUTE,
  isHealthResponse,
  type HealthResponse,
} from "../shared/api/health";

const DOCUMENT_TITLE = "Extra Credit Worksheet";
const HEALTH_REQUEST_TIMEOUT_MS = 500;
const HEALTH_RETRY_DELAYS_MS = [150, 300, 600] as const;

type HealthState =
  | { kind: "checking" }
  | { kind: "ready"; version: string }
  | { kind: "unavailable" };

const shellStyle: CSSProperties = {
  alignItems: "center",
  background:
    "radial-gradient(circle at 12% 14%, rgb(244 190 106 / 38%), transparent 28rem), radial-gradient(circle at 88% 84%, rgb(102 175 171 / 28%), transparent 30rem), #f7f3e8",
  color: "#24324a",
  display: "flex",
  fontFamily: 'Inter, ui-rounded, "Segoe UI", system-ui, sans-serif',
  justifyContent: "center",
  minHeight: "100vh",
  padding: "clamp(1.25rem, 5vw, 4rem)",
};

const cardStyle: CSSProperties = {
  background: "rgb(255 255 255 / 90%)",
  border: "1px solid rgb(36 50 74 / 12%)",
  borderRadius: "2rem",
  boxShadow: "0 1.5rem 4rem rgb(64 57 38 / 12%)",
  padding: "clamp(2rem, 7vw, 4.5rem)",
  width: "min(100%, 43rem)",
};

const healthBaseStyle: CSSProperties = {
  background: "#fff8e9",
  borderLeft: "0.3rem solid #d3943b",
  borderRadius: "0.3rem 0.9rem 0.9rem 0.3rem",
  padding: "1rem 1.15rem",
};

const healthStateStyles: Record<HealthState["kind"], CSSProperties> = {
  checking: {},
  ready: { background: "#edf8f3", borderLeftColor: "#2e7a67" },
  unavailable: { background: "#fff1f0", borderLeftColor: "#b23a3a" },
};

async function waitForRetry(
  delayMilliseconds: number,
  signal: AbortSignal,
): Promise<void> {
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

export function App() {
  const [health, setHealth] = useState<HealthState>({ kind: "checking" });

  useEffect(() => {
    document.title = DOCUMENT_TITLE;

    const controller = new AbortController();

    async function checkHealth(): Promise<void> {
      try {
        const body = await requestHealth(controller.signal);
        setHealth({ kind: "ready", version: body.version });
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

    return () => {
      controller.abort();
    };
  }, []);

  return (
    <main className="app-shell" style={shellStyle}>
      <section
        className="welcome-card"
        aria-labelledby="welcome-title"
        style={cardStyle}
      >
        <p
          className="eyebrow"
          style={{
            color: "#a14d2c",
            fontSize: "0.78rem",
            fontWeight: 750,
            letterSpacing: "0.12em",
            margin: "0 0 0.75rem",
            textTransform: "uppercase",
          }}
        >
          Local worksheet maker
        </p>
        <h1
          id="welcome-title"
          style={{
            color: "#17243a",
            fontSize: "clamp(2.5rem, 8vw, 5rem)",
            letterSpacing: "-0.055em",
            lineHeight: 0.96,
            margin: 0,
            maxWidth: "12ch",
          }}
        >
          Extra Credit Worksheet
        </h1>
        <p
          className="introduction"
          style={{
            color: "#566278",
            fontSize: "clamp(1rem, 2.4vw, 1.2rem)",
            lineHeight: 1.65,
            margin: "1.5rem 0 2.25rem",
            maxWidth: "35rem",
          }}
        >
          Create thoughtful, printable practice for your child while keeping
          family details on this computer.
        </p>

        <div
          className={`health health--${health.kind}`}
          style={{ ...healthBaseStyle, ...healthStateStyles[health.kind] }}
        >
          {health.kind !== "unavailable" && (
            <div role="status" aria-atomic="true">
              {health.kind === "checking" ? (
                <p>Checking the local server&hellip;</p>
              ) : (
                <>
                  <p
                    className="health__headline"
                    style={{ fontWeight: 750, margin: 0 }}
                  >
                    Ready on this computer.
                  </p>
                  <p
                    className="health__detail"
                    style={{
                      color: "#5c6677",
                      fontSize: "0.9rem",
                      margin: "0.25rem 0 0",
                    }}
                  >
                    Version {health.version}
                  </p>
                </>
              )}
            </div>
          )}

          {health.kind === "unavailable" && (
            <div role="alert">
              <p className="health__headline" style={{ fontWeight: 750, margin: 0 }}>
                The local server is unavailable.
              </p>
              <p
                className="health__detail"
                style={{ color: "#5c6677", fontSize: "0.9rem", margin: "0.25rem 0 0" }}
              >
                Stop and restart the Extra Credit development command, then
                reload this page.
              </p>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
