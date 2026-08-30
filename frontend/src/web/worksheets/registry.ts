import type { ComponentType } from "react";

import type { RegisteredWorksheetType } from "../../shared/worksheet/registry";
import type { WorksheetDocumentV1 } from "../../shared/worksheet/types";
import { CountCompareMakeRenderer } from "./count-compare-make/Renderer";
import { DryMathRenderer } from "./dry-math/Renderer";
import { FindTheWowRenderer } from "./find-the-wow/Renderer";
import { SentenceBuilderRenderer } from "./sentence-builder/Renderer";

export interface WorksheetRendererProps {
  readonly document: WorksheetDocumentV1;
}

export const WEB_WORKSHEET_RENDERERS = {
  "dry-math": DryMathRenderer,
  "find-the-wow": FindTheWowRenderer,
  "sentence-builder": SentenceBuilderRenderer,
  "count-compare-make": CountCompareMakeRenderer,
} as const satisfies Record<
  RegisteredWorksheetType,
  ComponentType<WorksheetRendererProps>
>;
