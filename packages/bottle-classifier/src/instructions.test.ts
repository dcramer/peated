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
    const reference = buildBottleClassifierInstructions();
    const audit = buildBottleAuditInstructions();

    expect(
      audit.startsWith(sharedPrefix(reference, "Reference Resolution Intent:")),
    ).toBe(true);
    expect(reference).not.toContain("Final Verification Phase");
    expect(reference).not.toContain("Operation Planning Phase");
  });

  test("keeps intent outputs and mutation authority separate", () => {
    const reference = buildBottleClassifierInstructions();
    const audit = buildBottleAuditInstructions();

    expect(reference).toContain("Reference Resolution Intent:");
    expect(reference).toContain("Use `repair_bottle` only");
    expect(reference).toContain(
      "When no candidate matches, create one complete Bottle",
    );
    expect(audit).toContain("Existing Bottle Audit Intent:");
    expect(audit).toContain(
      "Do not return a reference match/create/repair decision",
    );
    for (const instructions of [reference, audit]) {
      expect(instructions).toContain("proposal tools");
      expect(instructions).toMatch(/do not mutate|read-only/);
    }
  });

  test("keeps the reference prompt compact without dropping core boundaries", () => {
    const reference = buildBottleClassifierInstructions();

    expect(reference.length).toBeLessThan(28_000);
    for (const rule of [
      "Every marketed release is one independently complete Bottle",
      "Once reviewed evidence establishes equivalence",
      "Do not include proposed operations in the final structured output",
      "Use an evidenced canonical `proposedBottle.name`",
      "actual `toolsUsed`",
    ]) {
      expect(reference).toContain(rule);
    }
    expect(
      reference.match(
        /Every marketed release is one independently complete Bottle; BottleGroup assignment is automatic downstream\./g,
      ),
    ).toHaveLength(1);
  });

  test("asks image extraction to inspect the complete readable label", () => {
    const instructions = buildWhiskyLabelExtractorInstructions({
      mode: "image",
    });

    expect(instructions).toContain("Scan the complete readable label");
    expect(instructions).toContain("smaller secondary bands");
  });
});
