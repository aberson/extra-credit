import type { Locator } from "@playwright/test";

import type { OracleGridTable } from "../../oracles/arithmetic-oracle.js";

/*
 * Reads an Operation Grid exactly as the browser rendered it, for the
 * independent oracle to judge: nothing is read from the generated document.
 */

/** Reads one rendered grid table: corner, headers, each cell's number or null, and the given marks. */
export async function readGridTable(surface: Locator): Promise<OracleGridTable> {
  return await surface.locator("table").evaluate((table) => {
    const number = (content: string | null) => {
      const text = (content ?? "").trim();
      return text === "" ? null : Number(text);
    };
    const head = table.querySelector("thead tr");
    const rows = [...table.querySelectorAll("tbody tr")];
    return {
      corner: (head?.querySelector("td")?.textContent ?? "").trim(),
      columnHeaders: [...(head?.querySelectorAll("th") ?? [])].map((cell) => Number(cell.textContent)),
      rowHeaders: rows.map((row) => Number(row.querySelector("th")?.textContent)),
      cells: rows.map((row) => [...row.querySelectorAll("td")].map((cell) => number(cell.textContent))),
      given: rows.map((row) => [...row.querySelectorAll("td")].map((cell) => cell.hasAttribute("data-grid-given"))),
    };
  });
}
