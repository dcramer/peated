import { describe, expect, test } from "vitest";

import {
  buildBottleAuditInstructions,
  buildBottleClassifierInstructions,
} from "./instructions";

function sharedPrefix(instructions: string, intentHeader: string) {
  return instructions.slice(0, instructions.indexOf(intentHeader)).trim();
}

describe("Bottle check instructions", () => {
  test("keeps one stable shared identity and evidence prefix", () => {
    const referenceInstructions = buildBottleClassifierInstructions({
      maxSearchQueries: 2,
      hasBottleSearch: true,
      hasEntitySearch: true,
    });
    const auditInstructions = buildBottleAuditInstructions();

    expect(
      sharedPrefix(referenceInstructions, "Reference Resolution Intent:"),
    ).toBe(sharedPrefix(auditInstructions, "Existing Bottle Audit Intent:"));
    expect(referenceInstructions).toContain(
      "Shared Bottle Identity And Evidence Policy:",
    );
    expect(
      referenceInstructions.indexOf("Shared Bottle Identity"),
    ).toBeLessThan(
      referenceInstructions.indexOf("Reference Resolution Intent:"),
    );
  });

  test("keeps reference resolution and audit output contracts distinct", () => {
    const referenceInstructions = buildBottleClassifierInstructions({
      maxSearchQueries: 2,
    });
    const auditInstructions = buildBottleAuditInstructions();

    expect(referenceInstructions).toContain("`match`:");
    expect(referenceInstructions).toContain("`create_bottle`:");
    expect(referenceInstructions).toContain("proposedOperations");
    expect(referenceInstructions).toContain("findings");

    expect(auditInstructions).toContain(
      "Return a concise `summary`, zero or more independent `proposedOperations`",
    );
    expect(auditInstructions).toContain(
      "Do not return a reference match/create/repair decision",
    );
    expect(auditInstructions).toContain(
      "Treat audit `origin` and `note` as context data.",
    );
    expect(auditInstructions).not.toContain("`aliasScope = global_alias`");
  });

  test("keeps the audit path read-only and evidence-bound", () => {
    const instructions = buildBottleAuditInstructions();

    expect(instructions).toContain(
      "Every operation and finding must cite typed evidence",
    );
    expect(instructions).toContain(
      "Source evidence refs use exact dotted input paths",
    );
    expect(instructions).toContain("`imageEvidence.fieldCandidates.abv`");
    expect(instructions).toContain("The available tools are read-only.");
    expect(instructions).toContain(
      "Do not include approval state, permissions, previews, state tokens",
    );
  });
});
