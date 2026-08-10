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
      "<output_contract>",
    ]) {
      expect(reference).toContain(section);
    }
    expect(reference).not.toContain("<operation_policy>");
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

  test("keeps Suggested Change tools review-only and evidence-bound", () => {
    const reference = buildBottleClassifierInstructions();
    const audit = buildBottleAuditInstructions();

    expect(reference).toContain(
      "Reference Classification tools only collect identity evidence",
    );
    expect(reference).not.toContain(
      "Suggested Change tools record catalog changes for moderator review",
    );
    expect(reference).not.toContain("`availableSourceEvidenceFields`");

    expect(audit).toContain(
      "Suggested Change tools record catalog changes for moderator review",
    );
    expect(audit).toContain("A search result alone is not inspection");
    expect(audit).toContain("`availableSourceEvidenceFields`");
    expect(audit).toContain(
      "Do not include Suggested Changes in the final structured output",
    );
  });

  test("keeps audit intent separate from reference resolution", () => {
    const reference = buildBottleClassifierInstructions();
    const audit = buildBottleAuditInstructions();

    expect(reference).toContain(
      "Return `match` only when that exact candidate is safe",
    );
    expect(audit).toContain("Do not return a reference identity decision");
    expect(audit).toContain("Investigate the preloaded Bottle");
    expect(audit).toContain("Return its typed audit summary and findings");
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
