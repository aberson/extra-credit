import { useState, type CSSProperties } from "react";

import { getV1ProfileSupport } from "../../shared/config/profile-support";
import type { ChildProfileV1 } from "../../shared/config/schema";
import { ConfigApiError } from "../api/client";

export interface ProfileListProps {
  readonly disabled?: boolean;
  readonly onAdd: () => void;
  readonly onDelete: (profileId: string) => Promise<void>;
  readonly onEdit: (profile: ChildProfileV1) => void;
  readonly profiles: readonly ChildProfileV1[];
}

const buttonStyle: CSSProperties = {
  border: "1px solid #738098",
  borderRadius: "999px",
  cursor: "pointer",
  font: "inherit",
  padding: "0.45rem 0.8rem",
};

export function ProfileList({
  disabled = false,
  onAdd,
  onDelete,
  onEdit,
  profiles,
}: ProfileListProps) {
  const [deleteCandidate, setDeleteCandidate] = useState<ChildProfileV1 | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function confirmDelete(): Promise<void> {
    if (deleteCandidate === null || disabled) {
      return;
    }
    setDeleting(true);
    setDeleteError(null);
    try {
      await onDelete(deleteCandidate.id);
      setDeleteCandidate(null);
    } catch (error) {
      const message =
        error instanceof ConfigApiError
          ? error.code === "SESSION_TOKEN_INVALID"
            ? "The local server restarted. Nothing was deleted. Press Confirm delete again to use the fresh session."
            : error.code === "CONFIG_CONFLICT"
              ? "Another tab saved newer profiles. Nothing was deleted; reload before trying again."
              : `${error.message} Nothing was deleted.`
          : "The profile could not be deleted. Nothing was changed.";
      setDeleteError(message);
    } finally {
      setDeleting(false);
    }
  }

  if (profiles.length === 0) {
    return (
      <section aria-busy={disabled} aria-labelledby="first-profile-title">
        <h2 id="first-profile-title">Start with one reusable profile</h2>
        <p>
          Keep only a nickname, age, broad interests, and capabilities you have
          confirmed. The profile stays in the local configuration file.
        </p>
        <button disabled={disabled} onClick={onAdd} type="button">
          Create first profile
        </button>
      </section>
    );
  }

  return (
    <section aria-busy={disabled} aria-labelledby="profiles-title">
      <div style={{ alignItems: "center", display: "flex", flexWrap: "wrap", gap: "0.8rem", justifyContent: "space-between" }}>
        <div>
          <p style={{ color: "#a14d2c", fontSize: "0.76rem", fontWeight: 750, letterSpacing: "0.1em", margin: 0, textTransform: "uppercase" }}>
            Local profiles
          </p>
          <h2 id="profiles-title" style={{ margin: "0.15rem 0 0" }}>Choose a profile to update</h2>
        </div>
        <button disabled={disabled} onClick={onAdd} type="button">Add profile</button>
      </div>

      <ul style={{ display: "grid", gap: "0.7rem", listStyle: "none", margin: "1rem 0 0", padding: 0 }}>
        {profiles.map((profile) => {
          const support = getV1ProfileSupport(profile);
          return (
            <li key={profile.id} style={{ background: "#f6f8fb", border: "1px solid #dbe1e8", borderRadius: "0.8rem", padding: "0.8rem" }}>
              <div style={{ alignItems: "center", display: "flex", flexWrap: "wrap", gap: "0.65rem", justifyContent: "space-between" }}>
                <div>
                  <h3 style={{ margin: 0 }}>{profile.displayName ?? `Profile age ${profile.ageYears}`}</h3>
                  <p style={{ color: "#5c6677", margin: "0.2rem 0 0" }}>
                    Age {profile.ageYears} · {profile.presentationBand.replace("-", " ")} ·{" "}
                    {support.supported ? "worksheet band available" : "saved; generation unsupported"}
                  </p>
                </div>
                <div style={{ display: "flex", gap: "0.45rem" }}>
                  <button
                    disabled={disabled}
                    onClick={() => onEdit(profile)}
                    style={buttonStyle}
                    type="button"
                  >
                    Edit {profile.displayName ?? "profile"}
                  </button>
                  <button
                    disabled={disabled}
                    onClick={() => {
                      setDeleteError(null);
                      setDeleteCandidate(profile);
                    }}
                    style={{ ...buttonStyle, color: "#8c2c25" }}
                    type="button"
                  >
                    Delete {profile.displayName ?? "profile"}
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {deleteCandidate !== null && (
        <section
          aria-labelledby="delete-title"
          aria-modal="true"
          role="alertdialog"
          style={{ background: "#fff7e7", border: "2px solid #c3822d", borderRadius: "0.8rem", marginTop: "1rem", padding: "0.9rem" }}
        >
          <h3 id="delete-title" style={{ marginTop: 0 }}>
            Delete {deleteCandidate.displayName ?? "this profile"} from the live file?
          </h3>
          <p>
            This rewrites only the live profile file. Recovery backups, browser
            downloads, saved PDFs, and paper copies are not erased. Remove those
            separately from the configuration folder, your chosen download or PDF
            location, and your physical files if needed.
          </p>
          {deleteError !== null && <p role="alert">{deleteError}</p>}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.6rem" }}>
            <button
              disabled={deleting || disabled}
              onClick={() => void confirmDelete()}
              type="button"
            >
              {deleting ? "Deleting…" : "Confirm delete"}
            </button>
            <button
              disabled={deleting || disabled}
              onClick={() => setDeleteCandidate(null)}
              type="button"
            >
              Keep profile
            </button>
          </div>
        </section>
      )}
    </section>
  );
}
