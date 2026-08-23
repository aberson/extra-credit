import type { ComponentType } from "react";

import type { RegisteredWorksheetType } from "../../shared/worksheet/registry";
import type { WorksheetDocumentV1 } from "../../shared/worksheet/types";
import { DryMathRenderer } from "./dry-math/Renderer";

export interface WorksheetRendererProps {
  readonly document: WorksheetDocumentV1;
}

export const WEB_WORKSHEET_RENDERERS = {
  "dry-math": DryMathRenderer,
} as const satisfies Record<
  RegisteredWorksheetType,
  ComponentType<WorksheetRendererProps>
>;
