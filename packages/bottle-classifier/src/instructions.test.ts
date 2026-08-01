import { describe, expect, test } from "vitest";

import {
  buildBottleAuditInstructions,
  buildBottleClassifierInstructions,
  buildWhiskyLabelExtractorInstructions,
} from "./instructions";

function sharedPrefix(instructions: string, intentHeader: string) {
  return instructions.slice(0, instructions.indexOf(intentHeader)).trim();
}

describe("Bottle check instructions", () => {
  test("shares the stable identity and proposal policy across intents", () => {
    const reference = buildBottleClassifierInstructions({
      maxSearchQueries: 2,
    });
    const audit = buildBottleAuditInstructions();

    expect(
      audit.startsWith(sharedPrefix(reference, "Reference Resolution Intent:")),
    ).toBe(true);
    expect(reference).not.toContain("Final Verification Phase");
    expect(reference).not.toContain("Operation Planning Phase");
  });

  test("keeps intent outputs and mutation authority separate", () => {
    const reference = buildBottleClassifierInstructions({
      maxSearchQueries: 2,
    });
    const audit = buildBottleAuditInstructions();

    expect(reference).toContain("Reference Resolution Intent:");
    expect(reference).toContain("`match`:");
    expect(reference).toContain("`create_bottle`:");
    expect(audit).toContain("Existing Bottle Audit Intent:");
    expect(audit).toContain(
      "Do not return a reference match/create/repair decision",
    );
    for (const instructions of [reference, audit]) {
      expect(instructions).toContain("proposal tools");
      expect(instructions).toMatch(/do not mutate|read-only/);
    }
  });

  test("asks image extraction to inspect the complete readable label", () => {
    const instructions = buildWhiskyLabelExtractorInstructions({
      mode: "image",
    });

    expect(instructions).toContain("Scan the complete readable label");
    expect(instructions).toContain("smaller secondary bands");
  });
});
