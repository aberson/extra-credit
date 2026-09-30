/**
 * The one-time notice for a profile file an earlier version saved (U11).
 *
 * The Practice focus wording is the final copy for the worksheet controls that
 * replace Difficulty; it is shown here ahead of them on purpose, beside the
 * interim session-only Difficulty select. This notice is the only place a
 * parent reads the word "age" (U3).
 */
export const UPGRADE_NOTICE_TEXT =
  "This profile file was saved by an earlier version. Your profiles are shown unchanged; the next save updates the file and keeps a copy of the earlier file beside it. Age is no longer used, and Practice focus replaces Difficulty. A saved Difficulty of Confidence or Stretch no longer applies; each practice focus uses exactly its stated range.";

export interface UpgradeNoticeProps {
  /** True while the file on disk is still an earlier version. */
  readonly visible: boolean;
}

/**
 * A polite live region, deliberately without `role="status"`: the health line
 * is the page's one status owner (DD17). The region stays mounted so the
 * notice is announced when it appears, and it empties itself after the save
 * that upgrades the file. `print-controls` keeps it off the printed page.
 */
export function UpgradeNotice({ visible }: UpgradeNoticeProps) {
  return (
    <div aria-live="polite" className="print-controls upgrade-notice" data-upgrade-notice="true">
      {visible && (
        <p
          style={{
            background: "#eef4fb",
            borderLeft: "0.3rem solid #3f6f9f",
            borderRadius: "0.3rem 0.9rem 0.9rem 0.3rem",
            margin: "0 0 1rem",
            padding: "0.7rem 0.9rem",
          }}
        >
          {UPGRADE_NOTICE_TEXT}
        </p>
      )}
    </div>
  );
}
