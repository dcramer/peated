import { describe, expect, test } from "vitest";
import {
  deriveAutomationTier,
  type AutomationTierInput,
  type WebEvidenceJudgment,
} from "./automationTier";

// The tier has few enough inputs to check every one, so these tests cover the
// whole input space rather than examples. Rules come from "Deterministic Code"
// in `docs/architecture/bottle-classifier.md`. Each test lists the inputs that
// break its rule, so a failure prints them.
const WEB_EVIDENCE: WebEvidenceJudgment[] = [
  "not_needed",
  "not_used",
  "supportive",
  "weak",
  "conflicting",
  null,
  undefined,
];
const BOOLEANS = [false, true];

const ALL_INPUTS: AutomationTierInput[] = [];
for (const actionRiskClass of ["match", "create", "none"] as const)
  for (const webEvidence of WEB_EVIDENCE)
    for (const hasUnresolvedRisks of BOOLEANS)
      for (const hasMatchTarget of BOOLEANS)
        for (const reaffirmsCurrentAssignment of BOOLEANS)
          for (const replacesCurrentAssignment of BOOLEANS)
            for (const hasDeterministicAnchor of BOOLEANS)
              for (const hasPrimaryLabelOrImageEvidence of BOOLEANS)
                ALL_INPUTS.push({
                  actionRiskClass,
                  webEvidence,
                  hasUnresolvedRisks,
                  hasMatchTarget,
                  reaffirmsCurrentAssignment,
                  replacesCurrentAssignment,
                  hasDeterministicAnchor,
                  hasPrimaryLabelOrImageEvidence,
                });

const isAuto = (input: AutomationTierInput) =>
  deriveAutomationTier(input) === "auto";
const AUTO_INPUTS = ALL_INPUTS.filter(isAuto);
const REVIEW_INPUTS = ALL_INPUTS.filter((input) => !isAuto(input));

describe("deriveAutomationTier for every input", () => {
  test("checks every input", () => {
    expect(ALL_INPUTS).toHaveLength(3 * 7 * 2 ** 6);
    expect(AUTO_INPUTS.length).toBeGreaterThan(0);
  });

  test("any unresolved risk forces review", () => {
    expect(AUTO_INPUTS.filter((input) => input.hasUnresolvedRisks)).toEqual([]);
  });

  test("conflicting web evidence forces review, whatever the anchors", () => {
    expect(
      AUTO_INPUTS.filter((input) => input.webEvidence === "conflicting"),
    ).toEqual([]);
  });

  test("a No Match is never applied", () => {
    expect(
      AUTO_INPUTS.filter((input) => input.actionRiskClass === "none"),
    ).toEqual([]);
  });

  test("a match without a target, or one that replaces a current Bottle, needs review", () => {
    expect(
      AUTO_INPUTS.filter(
        (input) =>
          input.actionRiskClass === "match" &&
          (!input.hasMatchTarget || input.replacesCurrentAssignment),
      ),
    ).toEqual([]);
  });

  test("an applied decision always has support", () => {
    expect(
      AUTO_INPUTS.filter(
        (input) =>
          !input.hasDeterministicAnchor &&
          !input.hasPrimaryLabelOrImageEvidence &&
          input.webEvidence !== "supportive" &&
          // Only a match can rest on keeping its current Bottle or on the
          // agent saying local evidence settles it.
          !(
            input.actionRiskClass === "match" &&
            (input.reaffirmsCurrentAssignment ||
              input.webEvidence === "not_needed")
          ),
      ),
    ).toEqual([]);
  });

  test("more support never moves an applied decision to review", () => {
    const supported = AUTO_INPUTS.flatMap((input) => [
      { ...input, reaffirmsCurrentAssignment: true },
      { ...input, hasDeterministicAnchor: true },
      { ...input, hasPrimaryLabelOrImageEvidence: true },
      { ...input, webEvidence: "supportive" as const },
    ]);
    expect(supported.filter((input) => !isAuto(input))).toEqual([]);
  });

  test("more risk or weaker web evidence never applies a reviewed decision", () => {
    const riskier = REVIEW_INPUTS.flatMap((input) => [
      { ...input, hasUnresolvedRisks: true },
      { ...input, replacesCurrentAssignment: true },
      { ...input, hasMatchTarget: false },
      { ...input, webEvidence: "conflicting" as const },
      // Conflicting web evidence is the strongest reason for review, so only
      // other inputs are checked with weaker, non-conflicting web evidence.
      ...(input.webEvidence === "conflicting"
        ? []
        : WEB_EVIDENCE.filter(
            (web) =>
              web !== "supportive" &&
              web !== "not_needed" &&
              web !== "conflicting",
          ).map((webEvidence) => ({ ...input, webEvidence }))),
    ]);
    expect(riskier.filter(isAuto)).toEqual([]);
  });
});
