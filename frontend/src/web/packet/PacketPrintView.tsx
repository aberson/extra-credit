import { useEffect, useRef } from "react";

import { composePacketPages, type PacketKeyPlacement } from "../../shared/packet/compose";
import type { PaperSize } from "../../shared/worksheet/types";
import { WorksheetPreview } from "../preview/WorksheetPreview";
import { AnswerKeyView } from "../print/AnswerKeyView";
import "../print/print-letter.css";
import "../print/print-a4.css";
import "../print/print-packet.css";
import "../styles/tokens.css";
import { onPacketPaper, packetKeyLabel, type QueuedSheet } from "./packet-session";

const PACKET_PREVIEW_NOTICE_ID = "packet-preview-notice";

interface PacketPrintViewProps {
  readonly sheets: readonly QueuedSheet[];
  readonly paperSize: PaperSize;
  readonly keyPlacement: PacketKeyPlacement;
  readonly onBack: () => void;
  /** What a random packet just added: shown under the heading, screen only, and describes it. */
  readonly notice?: string | null;
}

/**
 * Every page of the session packet in print order (master plan Step 33), in
 * place of the single preview: one `.print-surface` per page, each rendering
 * its stored document on the packet paper at the sheet's own stored scale,
 * and every key heading naming its sheet. Print packet prints them all with
 * one `window.print()`; neither printing nor Back changes the queue.
 */
export function PacketPrintView({ keyPlacement, notice, onBack, paperSize, sheets }: PacketPrintViewProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => { headingRef.current?.focus(); }, []);
  const pages = composePacketPages(sheets, keyPlacement);
  const hasNotice = notice !== undefined && notice !== null;

  return (
    <section aria-labelledby="packet-preview-title" className="print-workspace packet-print" data-packet-print="true">
      <div className="print-controls">
        <h2
          aria-describedby={hasNotice ? PACKET_PREVIEW_NOTICE_ID : undefined}
          id="packet-preview-title"
          ref={headingRef}
          tabIndex={-1}
        >
          Packet preview
        </h2>
        {hasNotice && (
          <p data-packet-preview-notice="true" id={PACKET_PREVIEW_NOTICE_ID}>
            {notice}
          </p>
        )}
        <p>
          Every page of the packet in print order, each on its own page. Print on
          the packet paper at 100% scale, with browser headers and footers turned off.
        </p>
        <div className="packet-print__actions">
          <button onClick={() => window.print()} type="button">
            Print packet ({pages.length} {pages.length === 1 ? "page" : "pages"})
          </button>
          <button onClick={onBack} type="button">
            Back to worksheets
          </button>
        </div>
      </div>
      <div className="packet-print__pages">
        {pages.map((page, index) => {
          const document = onPacketPaper(page.sheet.document, paperSize);
          return (
            <div
              className="print-surface packet-print__page"
              data-packet-page={index + 1}
              data-paper-size={document.request.options.paperSize}
              data-print-scale={document.request.options.printScale}
              data-sheet-id={document.worksheetId}
              data-surface={page.surface}
              key={`${document.worksheetId}-${page.surface}`}
            >
              {page.surface === "worksheet" ? (
                <WorksheetPreview document={document} />
              ) : (
                <AnswerKeyView document={document} sheetLabel={packetKeyLabel(page)} />
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
