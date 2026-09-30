import type {
  ChildProfileV2,
  GenerationDefaultsV1,
} from "../../shared/config/schema";
import { canonicalContentKey } from "../../shared/worksheet/invariants";
import {
  capabilityProfileOf,
  NO_EARLIER_SETTINGS_MESSAGE,
  projectGenerationRequest,
  type ProjectAndGenerateResult,
} from "../../shared/worksheet/project-request";
import {
  getWorksheetRegistration,
  type RegisteredWorksheetType,
} from "../../shared/worksheet/registry";
import { formatSeedHex } from "../../shared/worksheet/seeded-random";
import type {
  WorksheetDocumentV1,
  WorksheetGeneratorV1,
} from "../../shared/worksheet/types";

export const MAX_ALTERNATIVE_SEED_ATTEMPTS = 16;

export type SeedSource = () => number;

/**
 * One Create: the stored profile, and (interim, D-interim) the unchanged
 * projection's preferences, whose Difficulty is the session-only select.
 */
export interface GenerationSelection {
  readonly profile: ChildProfileV2;
  readonly preferences: GenerationDefaultsV1;
  readonly stretchConfirmed: boolean;
  readonly worksheetType: RegisteredWorksheetType;
}

export interface WorksheetSession {
  readonly contentKey: string;
  readonly document: WorksheetDocumentV1;
}

export type SessionCreationResult =
  | { readonly ok: true; readonly session: WorksheetSession }
  | {
      readonly ok: false;
      readonly code: ProjectAndGenerateResult extends infer TResult
        ? TResult extends { readonly ok: false; readonly code: infer TCode }
          ? TCode
          : never
        : never;
      readonly message: string;
    };

export type MakeAnotherResult =
  | { readonly status: "changed"; readonly session: WorksheetSession }
  | { readonly status: "failed"; readonly message: string }
  | { readonly status: "exhausted"; readonly message: string };

interface SessionDependencies {
  readonly generator?: WorksheetGeneratorV1;
  readonly worksheetIdSource?: () => string;
}

function productionWorksheetId(): string {
  return crypto.randomUUID();
}

export function productionSeedSource(): number {
  const value = new Uint32Array(1);
  crypto.getRandomValues(value);
  return value[0] ?? 0;
}

/**
 * The selected family's own explanation of what bounds its variety.
 *
 * This message used to end "Review the profile limits" for every family. That
 * is right for the three math families and wrong for Sentence Builder, whose
 * limiting resource is the breadth of the reviewed vocabulary for a writing
 * mode: a parent following the old advice would edit stored numbers that
 * cannot change the outcome (issue #16). Asking the registration is the same
 * move `getEffectiveUnit` already makes for unit labels.
 */
function limitingResourceAdvice(selection: GenerationSelection): string {
  const capabilities = capabilityProfileOf(selection.profile);
  if (capabilities === undefined) {
    return NO_EARLIER_SETTINGS_MESSAGE;
  }
  return getWorksheetRegistration(
    selection.worksheetType,
  ).controls.getLimitingResourceAdvice({
    profile: capabilities,
    difficulty: selection.preferences.difficulty,
    length: selection.preferences.length,
    printScale: selection.preferences.printScale,
  });
}

function resultToSession(result: ProjectAndGenerateResult): SessionCreationResult {
  if (!result.ok) {
    return { ok: false, code: result.code, message: result.message };
  }
  return {
    ok: true,
    session: {
      document: result.document,
      contentKey: canonicalContentKey(result.document.items),
    },
  };
}

export function createWorksheetSessionForSeed(
  selection: GenerationSelection,
  seed: number,
  dependencies: SessionDependencies = {},
): SessionCreationResult {
  let seedHex: string;
  try {
    seedHex = formatSeedHex(seed);
  } catch {
    return {
      ok: false,
      code: "GENERATION_CONSTRAINT_CONFLICT",
      message: "A valid nonzero worksheet seed could not be created.",
    };
  }
  // Interim (D-interim): a profile stored without earlier settings is refused
  // here, before a lifecycle ID or any generator is reached.
  const capabilities = capabilityProfileOf(selection.profile);
  if (capabilities === undefined) {
    return {
      ok: false,
      code: "GENERATION_CONSTRAINT_CONFLICT",
      message: NO_EARLIER_SETTINGS_MESSAGE,
    };
  }
  const registration = getWorksheetRegistration(selection.worksheetType);
  const projection = projectGenerationRequest({
    profile: capabilities,
    preferences: selection.preferences,
    stretchConfirmed: selection.stretchConfirmed,
    worksheetType: selection.worksheetType,
    generatorVersion: registration.generatorVersion,
    seed: seedHex,
  });
  if (!projection.ok) {
    return resultToSession(projection);
  }
  return resultToSession(
    (dependencies.generator ?? registration.generate)(projection.request, {
      worksheetId:
        dependencies.worksheetIdSource?.() ?? productionWorksheetId(),
    }),
  );
}

export function createInitialWorksheetSession(
  selection: GenerationSelection,
  seedSource: SeedSource = productionSeedSource,
  dependencies: SessionDependencies = {},
): SessionCreationResult {
  for (let attempt = 0; attempt < MAX_ALTERNATIVE_SEED_ATTEMPTS; attempt += 1) {
    const candidate = seedSource();
    if (
      Number.isSafeInteger(candidate) &&
      candidate >= 1 &&
      candidate < 0x1_0000_0000
    ) {
      return createWorksheetSessionForSeed(selection, candidate, dependencies);
    }
  }
  return {
    ok: false,
    code: "GENERATION_CONSTRAINT_CONFLICT",
    message: "A nonzero worksheet seed was not available after 16 attempts.",
  };
}

export function makeAnotherWorksheetSession(
  current: WorksheetSession,
  selection: GenerationSelection,
  seedSource: SeedSource = productionSeedSource,
  dependencies: SessionDependencies = {},
): MakeAnotherResult {
  const currentSeed = Number.parseInt(current.document.seed, 16) >>> 0;
  for (let attempt = 0; attempt < MAX_ALTERNATIVE_SEED_ATTEMPTS; attempt += 1) {
    const candidate = seedSource();
    if (
      !Number.isSafeInteger(candidate) ||
      candidate < 1 ||
      candidate >= 0x1_0000_0000 ||
      candidate === currentSeed
    ) {
      continue;
    }
    const generated = createWorksheetSessionForSeed(
      selection,
      candidate,
      dependencies,
    );
    if (!generated.ok) {
      return { status: "failed", message: generated.message };
    }
    if (generated.session.contentKey !== current.contentKey) {
      return { status: "changed", session: generated.session };
    }
  }
  return {
    status: "exhausted",
    message: `No different worksheet was found in 16 attempts. ${limitingResourceAdvice(selection)}`,
  };
}
