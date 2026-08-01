import { describe, expect, test } from "vitest";

import {
  AuditBottleInputSchema,
  AuditBottleResultSchema,
  BottleOperationEntityChoiceSchema,
  BottleSharedPatchSchema,
  EvidenceRefSchema,
  FindingSchema,
  ProposedOperationSchema,
  SourceEvidencePathSchema,
} from "./index";

const evidenceRefs = [{ kind: "bottle" as const, bottleId: 42 }];

describe("bottle check public contract", () => {
  test("keeps the audit intent and origin server-owned", () => {
    expect(
      AuditBottleInputSchema.parse({
        bottleId: 42,
        origin: "moderator",
        note: "Check the 2022 edition.",
      }),
    ).toEqual({
      bottleId: 42,
      origin: "moderator",
      note: "Check the 2022 edition.",
    });

    expect(
      AuditBottleInputSchema.safeParse({
        bottleId: 42,
        origin: "moderator",
        intent: "resolve_reference",
      }).success,
    ).toBe(false);
    expect(
      AuditBottleInputSchema.safeParse({
        bottleId: 0,
        origin: "scheduled",
      }).success,
    ).toBe(false);
  });

  test("accepts all four operation variants", () => {
    const operations = [
      {
        type: "update_bottle",
        input: {
          bottleId: 42,
          patch: {
            shared: {
              name: "Cairdeas 2022 Warehouse 1",
              brand: { kind: "existing", entityId: 10 },
              bottler: {
                kind: "create",
                entity: {
                  name: "Example Bottler",
                  roles: ["bottler"],
                  country: "Scotland",
                },
              },
            },
            exact: {
              releaseYear: 2022,
              abv: 52.2,
            },
          },
        },
        rationale: "The catalog row combines the release with the wrong Brand.",
        evidenceRefs,
      },
      {
        type: "merge_bottles",
        input: {
          sourceBottleId: 43,
          destinationBottleId: 42,
        },
        rationale: "Both rows are the same marketed 2022 release.",
        evidenceRefs: [...evidenceRefs, { kind: "bottle", bottleId: 43 }],
      },
      {
        type: "update_entity",
        input: {
          entityId: 10,
          patch: {
            name: "Laphroaig",
            roles: ["brand", "distiller"],
            website: "https://www.laphroaig.com/",
          },
        },
        rationale: "The Entity has a stale name and missing distiller role.",
        evidenceRefs: [{ kind: "entity", entityId: 10 }],
      },
      {
        type: "merge_entities",
        input: {
          sourceEntityId: 11,
          destinationEntityId: 10,
        },
        rationale: "The source Entity is a duplicate spelling.",
        evidenceRefs: [
          { kind: "entity", entityId: 10 },
          { kind: "entity", entityId: 11 },
        ],
      },
    ];

    expect(
      operations.map((operation) => ProposedOperationSchema.parse(operation)),
    ).toHaveLength(4);
  });

  test("requires non-empty narrow patches and distinct merge targets", () => {
    expect(
      ProposedOperationSchema.safeParse({
        type: "update_bottle",
        input: { bottleId: 42, patch: {} },
        rationale: "Change something.",
        evidenceRefs,
      }).success,
    ).toBe(false);
    expect(
      ProposedOperationSchema.safeParse({
        type: "update_bottle",
        input: {
          bottleId: 42,
          patch: { shared: { description: "Model-authored content" } },
        },
        rationale: "Change presentation content.",
        evidenceRefs,
      }).success,
    ).toBe(false);
    expect(
      ProposedOperationSchema.safeParse({
        type: "update_entity",
        input: {
          entityId: 10,
          patch: { address: "A model-authored address" },
        },
        rationale: "Change an unsupported field.",
        evidenceRefs: [{ kind: "entity", entityId: 10 }],
      }).success,
    ).toBe(false);
    expect(
      ProposedOperationSchema.safeParse({
        type: "update_entity",
        input: {
          entityId: 10,
          patch: { roles: ["marketing_department"] },
        },
        rationale: "Add a role outside the supported Entity role enum.",
        evidenceRefs: [{ kind: "entity", entityId: 10 }],
      }).success,
    ).toBe(false);
    expect(
      ProposedOperationSchema.safeParse({
        type: "merge_bottles",
        input: {
          sourceBottleId: 42,
          destinationBottleId: 42,
        },
        rationale: "Invalid self-merge.",
        evidenceRefs,
      }).success,
    ).toBe(false);
  });

  test("preserves omission and null in the shared stated-age patch", () => {
    const omitted = BottleSharedPatchSchema.parse({
      name: "Cairdeas 2022 Warehouse 1",
    });
    const cleared = BottleSharedPatchSchema.parse({
      statedAge: null,
      seriesId: null,
    });

    expect("statedAge" in omitted).toBe(false);
    expect(cleared).toEqual({ statedAge: null, seriesId: null });
  });

  test("correlates type and input and rejects execution metadata", () => {
    expect(
      ProposedOperationSchema.safeParse({
        type: "merge_entities",
        input: {
          sourceBottleId: 43,
          destinationBottleId: 42,
        },
        rationale: "Mismatched resource input.",
        evidenceRefs,
      }).success,
    ).toBe(false);
    expect(
      ProposedOperationSchema.safeParse({
        type: "update_entity",
        input: {
          entityId: 10,
          patch: { name: "Laphroaig" },
        },
        rationale: "Rename the Entity.",
        evidenceRefs: [{ kind: "entity", entityId: 10 }],
        status: "approved",
      }).success,
    ).toBe(false);
  });

  test("requires typed evidence on findings and operations", () => {
    expect(
      FindingSchema.parse({
        scope: "bottle_group",
        summary: "Sibling rows disagree on the shared Brand.",
        evidenceRefs: [
          { kind: "bottle", bottleId: 42 },
          { kind: "web_result", url: "https://example.com/release" },
        ],
      }).evidenceRefs,
    ).toHaveLength(2);
    expect(
      FindingSchema.safeParse({
        scope: "bottle",
        summary: "Something is wrong.",
        evidenceRefs: [],
      }).success,
    ).toBe(false);
    expect(
      ProposedOperationSchema.safeParse({
        type: "update_entity",
        input: {
          entityId: 10,
          patch: { name: "Laphroaig" },
        },
        rationale: "Use the canonical name.",
        evidenceRefs: [],
      }).success,
    ).toBe(false);
    expect(
      EvidenceRefSchema.safeParse({
        kind: "web_result",
        url: "file:///tmp/evidence",
      }).success,
    ).toBe(false);
  });

  test("limits source evidence to documented serialized path shapes", () => {
    const validPaths = [
      "audit.note",
      "reference.name",
      "extractedIdentity.release_year",
      "imageEvidence.fieldCandidates.edition",
    ];
    for (const field of validPaths) {
      expect(SourceEvidencePathSchema.parse(field)).toBe(field);
      expect(
        EvidenceRefSchema.safeParse({ kind: "source", field }).success,
      ).toBe(true);
    }

    const invalidPaths = [
      "audit.origin",
      "reference",
      "reference.brand.name",
      "imageEvidence.fieldCandidates",
      "currentBottleContext.publicImages.labelEvidence.edition",
    ];
    for (const field of invalidPaths) {
      expect(SourceEvidencePathSchema.safeParse(field).success).toBe(false);
      expect(
        EvidenceRefSchema.safeParse({ kind: "source", field }).success,
      ).toBe(false);
    }
  });

  test("makes existing and create Entity choices unambiguous", () => {
    expect(
      BottleOperationEntityChoiceSchema.parse({
        kind: "existing",
        entityId: 10,
      }),
    ).toEqual({ kind: "existing", entityId: 10 });
    expect(
      BottleOperationEntityChoiceSchema.parse({
        kind: "create",
        entity: {
          name: "New Brand",
          roles: ["brand"],
          country: "Scotland",
          region: "Islay",
        },
      }),
    ).toMatchObject({ kind: "create", entity: { name: "New Brand" } });
    expect(
      BottleOperationEntityChoiceSchema.safeParse({
        id: null,
        name: "Ambiguous old shape",
      }).success,
    ).toBe(false);
    expect(
      BottleOperationEntityChoiceSchema.safeParse({
        kind: "create",
        entity: {
          name: "Invented location id",
          roles: ["brand"],
          countryId: 1,
        },
      }).success,
    ).toBe(false);
  });

  test("defines audit output without a redundant outcome", () => {
    const result = AuditBottleResultSchema.parse({
      summary: "The Bottle identity is consistent.",
      artifacts: {},
    });

    expect(result.proposedOperations).toEqual([]);
    expect(result.findings).toEqual([]);
    expect("outcome" in result).toBe(false);
  });
});
