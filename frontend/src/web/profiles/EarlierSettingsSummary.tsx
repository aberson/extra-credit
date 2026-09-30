import { Fragment } from "react";

import {
  DEFAULT_WORKSHEET_DEFAULTS_V2,
  worksheetSelectionOf,
} from "../../shared/config/defaults";
import {
  describeEarlierSettingDisclosure,
  selectionFromEarlierSettings,
} from "../../shared/config/earlier-settings";
import {
  describePracticeFocus,
  SENTENCE_VOCABULARY_LABELS,
} from "../../shared/config/practice-focus";
import type { LegacyChoicesV2 } from "../../shared/config/schema";
import { FIND_THE_WOW_VARIANT_LABELS } from "../../worksheets/find-the-wow/definition";
import { SENTENCE_BUILDER_VARIANT_LABELS } from "../../worksheets/sentence-builder/definition";

export interface EarlierSettingsSummaryProps {
  readonly legacyChoices: LegacyChoicesV2;
}

interface SummaryRow {
  readonly term: string;
  readonly value: string;
}

/**
 * The rows a child's earlier settings read as, in the worksheet panel's words.
 * The values come from the same mapping that seeds the worksheet panel, so a
 * row shows the value that mapping produces, clamped to the family's range; a
 * math group the earlier settings do not cover gets no row.
 */
function summaryRows(legacyChoices: LegacyChoicesV2): {
  readonly rows: readonly SummaryRow[];
  readonly notes: readonly string[];
} {
  const { selection, groups, disclosures } = selectionFromEarlierSettings(
    legacyChoices,
    worksheetSelectionOf(DEFAULT_WORKSHEET_DEFAULTS_V2),
  );
  const rows: SummaryRow[] = [
    {
      term: "Writing activity",
      value: SENTENCE_BUILDER_VARIANT_LABELS[selection.sentenceBuilder.variant],
    },
    {
      term: "Vocabulary",
      value: SENTENCE_VOCABULARY_LABELS[selection.sentenceBuilder.vocabulary],
    },
  ];
  if (groups.includes("dryMath")) {
    rows.push({
      term: "Dry Math",
      value: describePracticeFocus("dry-math", selection.dryMath),
    });
  }
  if (groups.includes("findTheWow.variant")) {
    const variant = selection.findTheWow.variant;
    rows.push({
      term: "Two Whats and a Wow",
      value: `${FIND_THE_WOW_VARIANT_LABELS[variant]}: ${
        variant === "equation"
          ? describePracticeFocus("find-the-wow-equation", selection.findTheWow.equation)
          : describePracticeFocus("find-the-wow-quantity", selection.findTheWow.quantity)
      }`,
    });
  }
  if (groups.includes("countCompareMake")) {
    rows.push({
      term: "Count, Compare & Make",
      value: describePracticeFocus("count-compare-make", selection.countCompareMake),
    });
  }
  return { rows, notes: disclosures.map(describeEarlierSettingDisclosure) };
}

/**
 * A read-only summary of the writing activity, vocabulary and math values a
 * child's profile kept from a file an earlier version saved. It renders no
 * control: the profile editor saves `legacyChoices` back exactly as stored.
 */
export function EarlierSettingsSummary({ legacyChoices }: EarlierSettingsSummaryProps) {
  const { rows, notes } = summaryRows(legacyChoices);
  return (
    <section
      aria-labelledby="earlier-settings-title"
      data-earlier-settings-summary="true"
      style={{ background: "#f6f8fb", border: "1px solid #dbe1e8", borderRadius: "0.7rem", marginTop: "0.8rem", padding: "0.7rem 0.9rem" }}
    >
      <h3 id="earlier-settings-title" style={{ fontSize: "1rem", margin: 0 }}>
        Earlier settings
      </h3>
      <p style={{ color: "#566278", margin: "0.3rem 0 0" }}>
        Kept read-only from a file an earlier version of Extra Credit saved.
        Choose the work for each worksheet in the worksheet panel.
      </p>
      <dl style={{ display: "grid", gap: "0.2rem 0.8rem", gridTemplateColumns: "max-content 1fr", margin: "0.5rem 0 0" }}>
        {rows.map(({ term, value }) => (
          <Fragment key={term}>
            <dt style={{ fontWeight: 650 }}>{term}</dt>
            <dd style={{ margin: 0 }}>{value}</dd>
          </Fragment>
        ))}
      </dl>
      {notes.length > 0 && (
        <ul data-earlier-settings-notes="true" style={{ margin: "0.5rem 0 0", paddingLeft: "1.2rem" }}>
          {notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
