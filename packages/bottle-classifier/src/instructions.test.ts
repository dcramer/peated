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
      expect(instructions).toContain("`availableSourceEvidenceFields`");
      expect(instructions).toContain("a search result alone is not inspection");
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
      "do not investigate, search, distinguish, reject, create, repair",
      "not a different Bottle solely because its stored Brand, category, age",
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

  test("soft-deprecates optional cask metadata without weakening marketed cask identity", () => {
    const reference = buildBottleClassifierInstructions();
    const audit = buildBottleAuditInstructions();

    expect(reference).toContain("marketed finish");
    expect(reference).toContain("exact cask codes");
    expect(reference).toContain("single-cask");
    expect(reference).toContain("cask-strength");
    expect(audit).toContain(
      "Do not investigate, propose an operation or finding, or require web or local search solely to fill or correct `caskType`, `caskSize`, or `caskFill`.",
    );
  });

  test("keeps bottler limited to an independently meaningful product role", () => {
    const reference = buildBottleClassifierInstructions();
    const extractor = buildWhiskyLabelExtractorInstructions({ mode: "image" });
    const audit = buildBottleAuditInstructions();

    expect(reference).toContain(
      "`bottler` is an independently meaningful, market-facing bottler or release imprint for this product",
    );
    expect(reference).toContain(
      "An ordinary official Brand or distillery bottling does not gain a bottler",
    );
    expect(reference).toContain(
      "It may equal the Brand or a producing distillery only when product-specific marketing establishes that separate role",
    );
    expect(reference).toContain(
      "Ownership, importer/distributor, and physical packing relationships alone do not establish it",
    );
    expect(audit).toContain(
      "supported gaps in ABV, release or vintage year, and distilleries",
    );
    expect(audit).toContain(
      "Do not treat a null bottler as a generic audit gap",
    );
    expect(extractor).toContain(
      "product-specific evidence names the market-facing bottler or release imprint for this product",
    );
    expect(extractor).toContain(
      "It may equal `brand` or a producing distillery",
    );
  });

  test("researches core missing facts without broadening the audit", () => {
    const reference = buildBottleClassifierInstructions();

    expect(reference).toContain(
      "make one focused web investigation before finalizing",
    );
    expect(reference).toContain(
      "ABV, a product-specific release or bottling year, or distilleries",
    );
    expect(reference).toContain(
      "This is not a general audit or exhaustive search",
    );
    expect(reference).toContain("each product-specific component distillery");
    expect(reference).toContain(
      "do not demote those producing distilleries to `observation`",
    );
    expect(reference).toContain(
      "other unknown core facts do not block a sparse `update_bottle`",
    );
    expect(reference).toContain("Do not guess or wait for complete enrichment");
  });

  test("asks image extraction to inspect the complete readable label", () => {
    const instructions = buildWhiskyLabelExtractorInstructions({
      mode: "image",
    });

    expect(instructions).toContain("Scan the complete readable label");
    expect(instructions).toContain("smaller secondary bands");
    expect(instructions).toContain("`Cask No. 71`");
    expect(instructions).toContain("never reduce it to bare digits");
    expect(instructions).toContain("never use it as `edition`");
    expect(instructions).toContain("leave `edition` null instead of guessing");
  });

  test("requires independent support for numeric image-derived repairs", () => {
    const audit = buildBottleAuditInstructions();

    expect(audit).toContain(
      "corroborate the exact characters with raw label text or focused external product evidence",
    );
    expect(audit).toContain(
      "Repeated or synthesized structured fields from one extraction are not independent support",
    );
  });
});
