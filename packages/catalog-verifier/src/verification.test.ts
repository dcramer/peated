import { describe, expect, test } from "vitest";
import {
  buildCatalogVerificationCreationMetadata,
  buildCatalogVerificationResult,
  getCatalogVerificationSkipReason,
  shouldRunCatalogVerification,
} from "./verification";

describe("catalog verifier policy", () => {
  test("runs verification for manual entries", () => {
    expect(shouldRunCatalogVerification("manual_entry")).toBe(true);
    expect(getCatalogVerificationSkipReason("manual_entry")).toBeNull();
  });

  test("skips trusted creation flows", () => {
    expect(shouldRunCatalogVerification("bottle_classifier")).toBe(false);
    expect(shouldRunCatalogVerification("price_match_review")).toBe(false);
    expect(shouldRunCatalogVerification("repair_workflow")).toBe(false);
    expect(getCatalogVerificationSkipReason("bottle_classifier")).toContain(
      "classifier",
    );
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
});
