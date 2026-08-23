import { describe, expect, test } from "vitest";

import {
  GENERATION_AGE_UNSUPPORTED,
  getV1ProfileSupport,
} from "./profile-support.js";

describe("getV1ProfileSupport", () => {
  test.each([4, 5, 6, 7, 8])("supports age %i", (ageYears) => {
    expect(getV1ProfileSupport({ ageYears })).toEqual({ supported: true });
  });

  test.each([9, 10, 11, 12, 13, 14, 15, 16, 17, 18])("retains but does not generate for age %i", (ageYears) => {
    expect(getV1ProfileSupport({ ageYears })).toEqual({
      supported: false,
      code: GENERATION_AGE_UNSUPPORTED,
    });
  });
});
