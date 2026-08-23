import type { ChildProfileV1 } from "./schema.js";

export const GENERATION_AGE_UNSUPPORTED =
  "GENERATION_AGE_UNSUPPORTED" as const;

export type V1ProfileSupport =
  | { readonly supported: true }
  | {
      readonly supported: false;
      readonly code: typeof GENERATION_AGE_UNSUPPORTED;
    };

export function getV1ProfileSupport(
  profileOrAge: Pick<ChildProfileV1, "ageYears"> | number,
): V1ProfileSupport {
  const ageYears =
    typeof profileOrAge === "number" ? profileOrAge : profileOrAge.ageYears;

  return ageYears >= 4 && ageYears <= 8
    ? { supported: true }
    : { supported: false, code: GENERATION_AGE_UNSUPPORTED };
}
