import type { ComponentType } from "react";

import type { RegisteredWorksheetType } from "../../shared/worksheet/registry";
import type { WorksheetDocumentV1 } from "../../shared/worksheet/types";
import { DryMathRenderer } from "./dry-math/Renderer";
import { FindTheWowRenderer } from "./find-the-wow/Renderer";

export interface WorksheetRendererProps {
  readonly document: WorksheetDocumentV1;
}

export const WEB_WORKSHEET_RENDERERS = {
  "dry-math": DryMathRenderer,
  "find-the-wow": FindTheWowRenderer,
} as const satisfies Record<
  RegisteredWorksheetType,
  ComponentType<WorksheetRendererProps>
>;
