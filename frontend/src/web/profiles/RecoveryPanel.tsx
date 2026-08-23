import { useState } from "react";

import type { AppConfigV1 } from "../../shared/config/schema";
import type { ConfigApiErrorCode } from "../api/client";

export interface RecoveryPanelProps {
  readonly configForDownload?: AppConfigV1;
  readonly confirmationDisabled?: boolean;
  readonly confirmed: boolean;
  readonly errorCode: ConfigApiErrorCode;
  readonly message: string;
  readonly onConfirmedChange: (confirmed: boolean) => void;
}

const recoverableCodes = new Set<ConfigApiErrorCode>(["CONFIG_INVALID"]);

export function RecoveryPanel({
  configForDownload,
  confirmationDisabled = false,
  confirmed,
  errorCode,
  message,
  onConfirmedChange,
}: RecoveryPanelProps) {
  const [downloadWarningAccepted, setDownloadWarningAccepted] = useState(false);
  const [downloadStatus, setDownloadStatus] = useState<string | null>(null);
  const recoverable = recoverableCodes.has(errorCode);

  function downloadDraft(): void {
    if (!downloadWarningAccepted || configForDownload === undefined) {
      return;
    }

    const blob = new Blob([`${JSON.stringify(configForDownload, null, 2)}\n`], {
      type: "application/json",
    });
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.download = "extra-credit-profile-backup.json";
    link.href = objectUrl;
    link.click();
    URL.revokeObjectURL(objectUrl);
    setDownloadStatus("The unsaved draft download was started with a generic filename.");
  }

  return (
    <section
      aria-labelledby="recovery-title"
      style={{ background: "#fff6e5", border: "2px solid #c3822d", borderRadius: "0.9rem", marginBottom: "1rem", padding: "0.9rem" }}
    >
      <h2 id="recovery-title" style={{ marginTop: 0 }}>
        The saved profile file needs attention
      </h2>
      <p role="alert">{message}</p>

      {recoverable ? (
        <>
          <p>
            The unreadable file is never shown or downloaded. You may prepare a
            valid replacement below. On explicit confirmation, the server first
            saves a byte-for-byte recovery backup and then replaces the live file.
          </p>
          <label style={{ display: "block", fontWeight: 650 }}>
            <input
              checked={confirmed}
              disabled={confirmationDisabled}
              onChange={(event) => onConfirmedChange(event.target.checked)}
              type="checkbox"
            />{" "}
            I understand that Back up invalid file and replace changes the live file.
          </label>

          <hr style={{ border: 0, borderTop: "1px solid #d8c59e", margin: "0.9rem 0" }} />
          <p>
            Optional draft download: the file contains the nickname, age, broad
            interests, and capabilities currently entered in this form. Store it
            somewhere private and delete it manually when no longer needed. The
            app never downloads the invalid raw file or starts a download by itself.
          </p>
          <label style={{ display: "block" }}>
            <input
              checked={downloadWarningAccepted}
              onChange={(event) => setDownloadWarningAccepted(event.target.checked)}
              type="checkbox"
            />{" "}
            I understand this creates a separate local copy containing the unsaved profile.
          </label>
          <button
            disabled={!downloadWarningAccepted || configForDownload === undefined}
            onClick={downloadDraft}
            style={{ marginTop: "0.6rem" }}
            type="button"
          >
            Download unsaved form
          </button>
          {configForDownload === undefined && (
            <p style={{ color: "#5c6677", fontSize: "0.88rem" }}>
              Complete a valid replacement profile before downloading it.
            </p>
          )}
          {downloadStatus !== null && <p role="status">{downloadStatus}</p>}
        </>
      ) : (
        <p>
          Automatic replacement is unavailable for this file state. Stop the app
          and follow the manual configuration guidance; the current file remains unchanged.
        </p>
      )}
    </section>
  );
}
