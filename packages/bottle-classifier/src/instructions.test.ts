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
  test("keeps one shared policy with small intent-specific contracts", () => {
    const referenceInstructions = buildBottleClassifierInstructions({
      maxSearchQueries: 2,
      hasBottleSearch: true,
      hasEntitySearch: true,
    });
    const auditInstructions = buildBottleAuditInstructions();
    const referencePrefix = sharedPrefix(
      referenceInstructions,
      "Reference Resolution Intent:",
    );

    expect(auditInstructions.startsWith(referencePrefix)).toBe(true);
    expect(referenceInstructions).toContain(
      "Shared Bottle Identity And Evidence Policy:",
    );
    expect(referenceInstructions).not.toContain("Final Verification Phase");
    expect(referenceInstructions).not.toContain("Operation Planning Phase");
  });

  test("resolves identity first and records optional cleanup with tools", () => {
    const instructions = buildBottleClassifierInstructions({
      maxSearchQueries: 2,
    });
    const identityIndex = instructions.indexOf(
      "Settle the reference identity first",
    );
    const cleanupIndex = instructions.indexOf(
      "operation review is opportunistic",
    );

    expect(instructions).toContain("`match`:");
    expect(instructions).toContain("`create_bottle`:");
    expect(identityIndex).toBeGreaterThan(-1);
    expect(cleanupIndex).toBeGreaterThan(identityIndex);
    expect(instructions).toContain("surfaced by the same evidence");
    expect(instructions).toContain("general catalog audit");
    expect(instructions).toContain(
      "Missing supplemental cleanup does not change the authoritative reference decision",
    );
    expect(instructions).toContain("`reference.currentBottleId`");
    expect(instructions).toContain("inspect both rows");
    expect(instructions).toContain("never proposed operations");
    expect(instructions).toContain("`reference.<field>`");
    expect(instructions).not.toContain("`audit.note`");
  });

  test("keeps audits active, read-only, and without a conclusion enum", () => {
    const instructions = buildBottleAuditInstructions();

    expect(instructions).toContain("Actively investigate");
    expect(instructions).toContain(
      "Return a concise `summary` and zero or more non-executable `findings`",
    );
    expect(instructions).toContain(
      "Do not return a reference match/create/repair decision",
    );
    expect(instructions).toContain(
      "For source evidence refs, use only `audit.note`",
    );
    expect(instructions).toContain("Actively use Bottle and Entity search");
    expect(instructions).toContain(
      "Actively resolve each concrete repair question",
    );
    expect(instructions).toContain("Keep web research focused");
    expect(instructions).toContain("authoritative external product evidence");
    expect(instructions).not.toContain("`reference.<field>`");
    expect(instructions).not.toContain("`aliasScope = global_alias`");
  });

  test("keeps proposal batches independent and evidence-bound", () => {
    for (const instructions of [
      buildBottleClassifierInstructions({ maxSearchQueries: 2 }),
      buildBottleAuditInstructions(),
    ]) {
      expect(instructions).toContain(
        "Before proposing an operation against an existing Bottle or Entity, inspect that target",
      );
      expect(instructions).toContain(
        "Never propose `update_bottle` for a Bottle that is also the `merge_bottles` source in the same batch",
      );
      expect(instructions).toContain(
        "A finding requires positive evidence of a real catalog defect",
      );
      expect(instructions).toContain("A finding is not a substitute");
      expect(instructions).toContain("A rejected tool result was not recorded");
      expect(instructions).toContain(
        "The merge retires that source and subsumes correction of its row",
      );
    }
  });

  test("prefers exact existing Bottles over identity-changing duplicate updates", () => {
    for (const instructions of [
      buildBottleClassifierInstructions({ maxSearchQueries: 2 }),
      buildBottleAuditInstructions(),
    ]) {
      expect(instructions).toContain(
        "Before an identity-changing `update_bottle`, search local Bottles",
      );
      expect(instructions).toContain(
        "merge the malformed duplicate into it instead of rewriting",
      );
      expect(instructions).toContain("An identity-retiring merge");
      expect(instructions).toContain("when that evidence is available");
      expect(instructions).toContain(
        "do not infer equivalence from catalog data alone",
      );
      expect(instructions).toContain(
        "Keep `update_bottle` patches sparse: include only fields whose stored values need to change.",
      );
    }
  });

  test("asks image extraction to inspect secondary identity text", () => {
    const instructions = buildWhiskyLabelExtractorInstructions({
      mode: "image",
    });

    expect(instructions).toContain("Scan the complete readable label");
    expect(instructions).toContain(
      "smaller secondary bands, subtitles, and neck tags",
    );
    expect(instructions).toContain(
      "identity-bearing edition, batch, release, finish, and variant text",
    );
  });
});
