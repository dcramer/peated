import { describe, expect, test } from "vitest";
import {
  CatalogVerificationFindingKindEnum,
  CatalogVerificationResultSchema,
  CatalogVerificationWorkstreamEnum,
  buildCatalogVerificationCreationMetadata,
  buildCatalogVerificationResult,
  getCatalogVerificationSkipReason,
  shouldRunCatalogVerification,
} from "./verification";

describe("catalog verifier policy", () => {
  test("exposes only active verification workstreams and finding kinds", () => {
    expect(CatalogVerificationWorkstreamEnum.options).toEqual([
      "brand-repairs",
      "entity-audits",
    ]);
    expect(CatalogVerificationFindingKindEnum.options).toEqual([
      "brand_repair_candidate",
      "entity_audit_candidate",
    ]);
  });

  test("runs verification for manual entries", () => {
    const input = { objectType: "bottle", source: "manual_entry" } as const;

    expect(shouldRunCatalogVerification(input)).toBe(true);
    expect(getCatalogVerificationSkipReason(input)).toBeNull();
  });

  test("skips automated Bottle audits but checks automated entities", () => {
    const bottleInput = {
      objectType: "bottle",
      source: "price_match_automation",
    } as const;
    const entityInput = {
      objectType: "entity",
      source: "price_match_automation",
    } as const;

    expect(shouldRunCatalogVerification(bottleInput)).toBe(false);
    expect(getCatalogVerificationSkipReason(bottleInput)).toContain(
      "already checked",
    );
    expect(shouldRunCatalogVerification(entityInput)).toBe(true);
    expect(getCatalogVerificationSkipReason(entityInput)).toBeNull();
  });

  test("skips reviewed and repair creation flows", () => {
    expect(
      shouldRunCatalogVerification({
        objectType: "bottle",
        source: "bottle_classifier",
      }),
    ).toBe(false);
    expect(
      shouldRunCatalogVerification({
        objectType: "bottle",
        source: "price_match_review",
      }),
    ).toBe(false);
    expect(
      shouldRunCatalogVerification({
        objectType: "entity",
        source: "repair_workflow",
      }),
    ).toBe(false);
    expect(
      getCatalogVerificationSkipReason({
        objectType: "bottle",
        source: "bottle_classifier",
      }),
    ).toContain("classifier");
  });

  test("runs verification for manual entities", () => {
    expect(
      shouldRunCatalogVerification({
        objectType: "entity",
        source: "manual_entry",
      }),
    ).toBe(true);
  });

  test("builds parsed creation metadata and results", () => {
    expect(
      buildCatalogVerificationCreationMetadata("manual_entry"),
    ).toMatchObject({
      phase: "creation",
      creationSource: "manual_entry",
    });

    expect(
      buildCatalogVerificationResult({
        source: "manual_entry",
        status: "flagged",
        reason: null,
        findings: [
          {
            kind: "entity_audit_candidate",
            summary: "Needs review.",
            details: null,
            workstream: "entity-audits",
          },
        ],
      }),
    ).toMatchObject({
      phase: "result",
      status: "flagged",
      source: "manual_entry",
    });
  });

  test("parses historical canon-repair findings without exposing them as active options", () => {
    expect(
      CatalogVerificationResultSchema.parse({
        phase: "result",
        source: "manual_entry",
        status: "flagged",
        reason: null,
        findings: [
          {
            kind: "canon_repair_candidate",
            summary: "Bottle wording may match another release.",
            details: null,
            workstream: "canon-repairs",
          },
        ],
      }),
    ).toMatchObject({
      findings: [
        {
          kind: "canon_repair_candidate",
          workstream: "canon-repairs",
        },
      ],
    });
  });

  test("rejects historical canon-repair findings from the active result builder", () => {
    const historicalFinding = {
      kind: "canon_repair_candidate",
      summary: "Bottle wording may match another release.",
      details: null,
      workstream: "canon-repairs",
    } as const;

    expect(() =>
      buildCatalogVerificationResult({
        source: "manual_entry",
        status: "flagged",
        reason: null,
        findings: [
          // @ts-expect-error Historical findings are readable but cannot be written.
          historicalFinding,
        ],
      }),
    ).toThrow();
  });
});
