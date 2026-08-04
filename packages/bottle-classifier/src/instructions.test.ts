import { describe, expect, test } from "vitest";

import {
  buildBottleAuditInstructions,
  buildBottleClassifierInstructions,
  buildWhiskyLabelExtractorInstructions,
} from "./instructions";

describe("Bottle check instructions", () => {
  test("keeps the reference prompt lean and explicitly structured", () => {
    const reference = buildBottleClassifierInstructions();

    expect(reference.length).toBeLessThan(12_000);
    for (const section of [
      "<mission>",
      "<success_criteria>",
      "<identity_policy>",
      "<evidence_policy>",
      "<decision_policy>",
      "<tool_policy>",
      "<operation_policy>",
      "<output_contract>",
    ]) {
      expect(reference).toContain(section);
    }
  });

  test("preserves the exact Bottle and conservative-decision boundaries", () => {
    const reference = buildBottleClassifierInstructions();

    for (const rule of [
      "Every marketed release is one independently complete Bottle",
      "an inspected undated candidate can match only when evidence establishes an independently marketed undated product",
      "Do not infer this from a generic catalog row or collapse a family marketed only as distinct batches",
      "Prefer `no_match` over a false-positive match",
      "never create a duplicate merely because its stored Brand",
      "Return `match` when that exact candidate is safe for the reference assignment",
      "Return `repair_bottle` only when the candidate is the exact product",
      "Return `create_bottle` only when no inspected local candidate represents",
      "Return `no_match` when the exact identity remains missing, ambiguous, conflicting, underspecified",
    ]) {
      expect(reference).toContain(rule);
    }
  });

  test("keeps Firecrawl as evidence controlled by the main agent", () => {
    const reference = buildBottleClassifierInstructions();

    expect(reference).toContain(
      "Use Firecrawl search when current label and catalog evidence cannot resolve an identity-critical fact",
    );
    expect(reference).toContain(
      "Do not call Firecrawl when trusted input and inspected local context already determine the decision",
    );
    expect(reference).toContain(
      "When Firecrawl is unavailable or returns insufficient evidence",
    );
    expect(reference).toContain("Search results are candidates, not evidence");
    expect(reference).toContain(
      "A conflict with a confirmed age, ABV, year, edition, or cask identifies a sibling",
    );
    expect(reference).not.toContain("OpenAI web search");
    expect(reference).not.toContain("before reasoning");
  });

  test("keeps identity roles and marketed cask traits distinct", () => {
    const reference = buildBottleClassifierInstructions();

    expect(reference).toContain(
      "Keep the consumer-facing Brand, producing distilleries, and market-facing bottler distinct",
    );
    expect(reference).toContain(
      "An ordinary official Brand or distillery bottling has no bottler",
    );
    expect(reference).toContain("marketed finish or variant wording");
    expect(reference).toContain("exact-cask identity");
    expect(reference).toContain("cask-strength");
    expect(reference).toContain(
      "do not investigate, search, distinguish, reject, create, repair, or add risk solely for those fields",
    );
  });

  test("keeps proposal tools review-only and evidence-bound", () => {
    for (const instructions of [
      buildBottleClassifierInstructions(),
      buildBottleAuditInstructions(),
    ]) {
      expect(instructions).toContain(
        "Proposal tools record suggestions for moderator review",
      );
      expect(instructions).toContain("a search result alone is not inspection");
      expect(instructions).toContain("`availableSourceEvidenceFields`");
      expect(instructions).toContain(
        "Do not include proposed operations in the final structured output",
      );
    }
  });

  test("keeps audit intent separate from reference resolution", () => {
    const reference = buildBottleClassifierInstructions();
    const audit = buildBottleAuditInstructions();

    expect(reference).toContain(
      "Return `match` when that exact candidate is safe",
    );
    expect(audit).toContain(
      "Do not return a reference match, create, repair decision",
    );
    expect(audit).toContain(
      "Investigate the preloaded Bottle and return its typed audit summary",
    );
    expect(audit).toContain(
      "compare every evidence-supported identity field with the stored Bottle",
    );
    expect(audit).not.toContain("Return `create_bottle`");
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
});
