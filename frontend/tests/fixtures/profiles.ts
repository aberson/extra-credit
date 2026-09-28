import { readFileSync } from "node:fs";

import { AppConfigV1Schema } from "../../src/shared/config/schema.js";

// Read only the committed fictional example, never the local family config.
export const acceptanceConfig = AppConfigV1Schema.parse(JSON.parse(
  readFileSync(new URL("../../../config/children.example.json", import.meta.url), "utf8"),
));
