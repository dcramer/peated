import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  auditBottleEvalFixtureSchema,
  listFixtureFiles,
  type AuditBottleEvalFixture,
} from "./evalFixtureSchemas";

const fixtureDir = fileURLToPath(
  new URL("./eval-fixtures/audit-cases/", import.meta.url),
);

function loadAuditBottleEvalFixtures(): AuditBottleEvalFixture[] {
  return listFixtureFiles(fixtureDir).map((filename) =>
    auditBottleEvalFixtureSchema.parse(
      JSON.parse(readFileSync(filename, "utf8")),
    ),
  );
}

export const AUDIT_BOTTLE_EVAL_CASES = loadAuditBottleEvalFixtures();
