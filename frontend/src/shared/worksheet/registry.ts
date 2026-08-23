import {
  DRY_MATH_DEFINITION,
} from "../../worksheets/dry-math/definition.js";
import { generateDryMath } from "../../worksheets/dry-math/generator.js";
import type {
  WorksheetGeneratorV1,
  WorksheetType,
} from "./types.js";

export interface WorksheetRegistrationV1 {
  readonly id: WorksheetType;
  readonly displayName: string;
  readonly generatorVersion: number;
  readonly generate: WorksheetGeneratorV1;
  readonly hasAnswerKey: boolean;
  readonly usesInterests: boolean;
}

export const WORKSHEET_REGISTRY = {
  "dry-math": {
    ...DRY_MATH_DEFINITION,
    generate: generateDryMath,
  },
} as const satisfies Record<string, WorksheetRegistrationV1>;

export type RegisteredWorksheetType = keyof typeof WORKSHEET_REGISTRY;

export const REGISTERED_WORKSHEET_IDS = Object.freeze(
  Object.keys(WORKSHEET_REGISTRY) as RegisteredWorksheetType[],
);

export function getWorksheetRegistration(
  worksheetType: RegisteredWorksheetType,
): WorksheetRegistrationV1 {
  return WORKSHEET_REGISTRY[worksheetType];
}
