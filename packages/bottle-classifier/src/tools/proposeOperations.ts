import { tool } from "@openai/agents";
import { z } from "zod";

import {
  DEFAULT_MAX_PROPOSED_OPERATIONS,
  MergeBottlesOperationInputSchema,
  MergeBottlesOperationSchema,
  MergeEntitiesOperationInputSchema,
  MergeEntitiesOperationSchema,
  ProposedOperationEnvelopeFields,
  ProposedOperationSchema,
  UpdateBottleOperationInputSchema,
  UpdateBottleOperationSchema,
  UpdateEntityOperationInputSchema,
  UpdateEntityOperationSchema,
  type BottlePatch,
  type EvidenceRef,
  type ProposedOperation,
} from "../bottleCheckContract";
import { getExactCaskCodeAnchor } from "../exactCask";
import { isSmwsIdentityAnchor } from "../smwsPolicy";

const UpdateBottleProposalArgsSchema =
  UpdateBottleOperationInputSchema.safeExtend(ProposedOperationEnvelopeFields);
const MergeBottlesProposalArgsSchema =
  MergeBottlesOperationInputSchema.safeExtend(ProposedOperationEnvelopeFields);
const UpdateEntityProposalArgsSchema =
  UpdateEntityOperationInputSchema.safeExtend(ProposedOperationEnvelopeFields);
const MergeEntitiesProposalArgsSchema =
  MergeEntitiesOperationInputSchema.safeExtend(ProposedOperationEnvelopeFields);

type ProposalCollectionContext = {
  hasBottleEvidence: (bottleId: number) => boolean;
  hasEntityEvidence: (entityId: number) => boolean;
  hasSourceEvidence: (field: string) => boolean;
  hasWebEvidence: (url: string) => boolean;
  isBottleInspected: (bottleId: number) => boolean;
  isEntityInspected: (entityId: number) => boolean;
  isSeriesInspected: (seriesId: number) => boolean;
  getBottleBranding: (
    bottleId: number,
  ) => { brand: string; bottler: string | null } | null;
  getUnsupportedPopulatedBottlePatchField: (
    bottleId: number,
    patch: BottlePatch,
  ) => keyof BottlePatch | null;
};

type ProposalRecordResult =
  | { status: "updated"; proposalIndex: number }
  | { status: "recorded"; proposalIndex: number }
  | { status: "rejected"; reason: string };

type ProposedOperationCandidate = {
  type: ProposedOperation["type"];
  input?: Record<string, ToolCallPayload>;
  rationale?: ToolCallPayload;
  evidenceRefs?: ToolCallPayload;
};

const ToolCallPayloadSchema = z.json();
type ToolCallPayload = z.infer<typeof ToolCallPayloadSchema>;

export type BottleProposalCollector = {
  getProposals: () => ProposedOperation[];
  getMissingEvidence: (
    evidenceRefs: readonly EvidenceRef[],
  ) => EvidenceRef | null;
  getUninspectedEvidence: (
    evidenceRefs: readonly EvidenceRef[],
  ) => EvidenceRef | null;
  record: (proposal: ProposedOperationCandidate) => ProposalRecordResult;
};

function evidenceWasCollected(
  evidence: EvidenceRef,
  context: ProposalCollectionContext,
) {
  switch (evidence.kind) {
    case "source":
      return context.hasSourceEvidence(evidence.field);
    case "bottle":
      return context.hasBottleEvidence(evidence.bottleId);
    case "entity":
      return context.hasEntityEvidence(evidence.entityId);
    case "web_result":
      return context.hasWebEvidence(evidence.url);
  }
}

function uninspectedTarget(
  proposal: ProposedOperation,
  context: ProposalCollectionContext,
): string | null {
  switch (proposal.type) {
    case "update_bottle": {
      if (!context.isBottleInspected(proposal.input.bottleId)) {
        return `Bottle ${proposal.input.bottleId} was not inspected.`;
      }
      const seriesId = proposal.input.patch.seriesId;
      if (
        seriesId !== undefined &&
        seriesId !== null &&
        !context.isSeriesInspected(seriesId)
      ) {
        return `BottleSeries ${seriesId} was not inspected.`;
      }
      const choices = [
        proposal.input.patch.brand,
        ...(proposal.input.patch.distillers ?? []),
        proposal.input.patch.bottler,
      ];
      const uninspectedEntity = choices.find(
        (choice) =>
          choice?.kind === "existing" &&
          !context.isEntityInspected(choice.entityId),
      );
      return uninspectedEntity?.kind === "existing"
        ? `Entity ${uninspectedEntity.entityId} was not inspected.`
        : null;
    }
    case "merge_bottles":
      if (!context.isBottleInspected(proposal.input.sourceBottleId)) {
        return `Bottle ${proposal.input.sourceBottleId} was not inspected.`;
      }
      return context.isBottleInspected(proposal.input.destinationBottleId)
        ? null
        : `Bottle ${proposal.input.destinationBottleId} was not inspected.`;
    case "update_entity":
      return context.isEntityInspected(proposal.input.entityId)
        ? null
        : `Entity ${proposal.input.entityId} was not inspected.`;
    case "merge_entities":
      if (!context.isEntityInspected(proposal.input.sourceEntityId)) {
        return `Entity ${proposal.input.sourceEntityId} was not inspected.`;
      }
      return context.isEntityInspected(proposal.input.destinationEntityId)
        ? null
        : `Entity ${proposal.input.destinationEntityId} was not inspected.`;
  }
}

function requiredTargetEvidence(proposal: ProposedOperation): EvidenceRef[] {
  switch (proposal.type) {
    case "update_bottle": {
      const choices = [
        proposal.input.patch.brand,
        ...(proposal.input.patch.distillers ?? []),
        proposal.input.patch.bottler,
      ];
      return [
        { kind: "bottle", bottleId: proposal.input.bottleId },
        ...choices.flatMap((choice) =>
          choice?.kind === "existing"
            ? [{ kind: "entity" as const, entityId: choice.entityId }]
            : [],
        ),
      ];
    }
    case "merge_bottles":
      return [
        { kind: "bottle", bottleId: proposal.input.sourceBottleId },
        { kind: "bottle", bottleId: proposal.input.destinationBottleId },
      ];
    case "update_entity":
      return [{ kind: "entity", entityId: proposal.input.entityId }];
    case "merge_entities":
      return [
        { kind: "entity", entityId: proposal.input.sourceEntityId },
        { kind: "entity", entityId: proposal.input.destinationEntityId },
      ];
  }
}

function evidenceMatches(left: EvidenceRef, right: EvidenceRef) {
  switch (left.kind) {
    case "source":
      return right.kind === "source" && left.field === right.field;
    case "bottle":
      return right.kind === "bottle" && left.bottleId === right.bottleId;
    case "entity":
      return right.kind === "entity" && left.entityId === right.entityId;
    case "web_result":
      return right.kind === "web_result" && left.url === right.url;
  }
}

function getSmwsEditionError(
  proposal: ProposedOperation,
  context: ProposalCollectionContext,
): string | null {
  if (proposal.type !== "update_bottle") {
    return null;
  }

  const edition = proposal.input.patch.edition;
  if (!edition || !getExactCaskCodeAnchor(edition)) {
    return null;
  }

  const branding = context.getBottleBranding(proposal.input.bottleId);
  if (
    !branding ||
    ![branding.brand, branding.bottler].some(isSmwsIdentityAnchor)
  ) {
    return null;
  }

  // SMWS code identity is materialized in the Bottle name by the package's
  // deterministic SMWS policy; accepting it as edition would render it twice.
  return "SMWS exact-cask codes belong in the Bottle name, not the edition field. Omit the edition field from this proposal.";
}

export function createBottleProposalCollector({
  context,
  maxProposals = DEFAULT_MAX_PROPOSED_OPERATIONS,
}: {
  context: ProposalCollectionContext;
  maxProposals?: number;
}): BottleProposalCollector {
  const proposals: ProposedOperation[] = [];
  const proposalIndexes = new Map<string, number>();

  const getMissingEvidence = (evidenceRefs: readonly EvidenceRef[]) =>
    evidenceRefs.find((evidence) => !evidenceWasCollected(evidence, context)) ??
    null;
  const getUninspectedEvidence = (evidenceRefs: readonly EvidenceRef[]) =>
    evidenceRefs.find((evidence) => {
      if (evidence.kind === "bottle") {
        return !context.isBottleInspected(evidence.bottleId);
      }
      if (evidence.kind === "entity") {
        return !context.isEntityInspected(evidence.entityId);
      }
      return false;
    }) ?? null;

  return {
    getProposals: () => [...proposals],
    getMissingEvidence,
    getUninspectedEvidence,
    record: (rawProposal) => {
      const parsed = ProposedOperationSchema.safeParse(rawProposal);
      if (!parsed.success) {
        return {
          status: "rejected",
          reason: z.prettifyError(parsed.error),
        };
      }

      const proposal = parsed.data;
      const smwsEditionError = getSmwsEditionError(proposal, context);
      if (smwsEditionError) {
        return { status: "rejected", reason: smwsEditionError };
      }

      const targetError = uninspectedTarget(proposal, context);
      if (targetError) {
        return { status: "rejected", reason: targetError };
      }

      const missingEvidence = getMissingEvidence(proposal.evidenceRefs);
      if (missingEvidence) {
        return {
          status: "rejected",
          reason: `Evidence was not collected: ${JSON.stringify(missingEvidence)}.`,
        };
      }

      const uncitedTarget = requiredTargetEvidence(proposal).find(
        (target) =>
          !proposal.evidenceRefs.some((evidence) =>
            evidenceMatches(target, evidence),
          ),
      );
      if (uncitedTarget) {
        return {
          status: "rejected",
          reason: `Operation target was not cited as evidence: ${JSON.stringify(uncitedTarget)}.`,
        };
      }

      if (proposal.type === "update_bottle") {
        const unsupportedField =
          context.getUnsupportedPopulatedBottlePatchField(
            proposal.input.bottleId,
            proposal.input.patch,
          );
        if (unsupportedField) {
          return {
            status: "rejected",
            reason: `Changing populated Bottle field ${JSON.stringify(unsupportedField)} requires a matching structured Bottle observation or two agreeing label images. Unstructured web results and one image extraction cannot overwrite an existing value.`,
          };
        }
      }

      const key = JSON.stringify({
        type: proposal.type,
        input: proposal.input,
      });
      const existingIndex = proposalIndexes.get(key);
      if (existingIndex !== undefined) {
        proposals[existingIndex] = proposal;
        return { status: "updated", proposalIndex: existingIndex };
      }
      if (proposals.length >= maxProposals) {
        return {
          status: "rejected",
          reason: `The proposal limit of ${maxProposals} was reached.`,
        };
      }

      const proposalIndex = proposals.length;
      proposals.push(proposal);
      proposalIndexes.set(key, proposalIndex);
      return { status: "recorded", proposalIndex };
    },
  };
}

const ToolJsonSchema = z
  .object({
    type: z.literal("object"),
    properties: z.record(z.string(), z.looseObject({})).default({}),
    required: z.array(z.string()).default([]),
    description: z.string().optional(),
  })
  .loose();

function nonStrictJsonSchema(schema: z.ZodType) {
  const additionalProperties: true = true;
  const jsonSchema = ToolJsonSchema.parse(
    z.toJSONSchema(schema, { target: "draft-7" }),
  );
  return {
    ...jsonSchema,
    additionalProperties,
  };
}

const StoredOperationArgsSchema = z
  .object({
    rationale: z.json().optional(),
    evidenceRefs: z.json().optional(),
  })
  .catchall(z.json());

function toStoredOperation(
  type: ProposedOperation["type"],
  args: ToolCallPayload,
): ProposedOperationCandidate {
  const parsedArgs = StoredOperationArgsSchema.safeParse(args);
  if (!parsedArgs.success) return { type };
  const { rationale, evidenceRefs, ...input } = parsedArgs.data;
  const operation: ProposedOperationCandidate = { type, input };
  if (rationale !== undefined) operation.rationale = rationale;
  if (evidenceRefs !== undefined) operation.evidenceRefs = evidenceRefs;
  return operation;
}

const PROPOSAL_RESULT_DESCRIPTION =
  "Returns `{ status: recorded | updated, proposalIndex }` when saved, or `{ status: rejected, reason }`; a rejected proposal was not recorded, so fix the stated reason before retrying.";

function proposalToolDescription(description: string) {
  return `${description} ${PROPOSAL_RESULT_DESCRIPTION}`;
}

export function createBottleProposalTools(collector: BottleProposalCollector) {
  return [
    tool({
      name: "propose_update_bottle",
      description: proposalToolDescription(
        "Record one read-only proposal to update one inspected Bottle. Include every supported field change for that Bottle in one sparse patch. Use only after investigating the Bottle and collecting every cited piece of evidence. Remove a populated relationship or change a populated exact field only when evidence for that Bottle shows it is wrong; omission is not enough. One label-image extraction may fill a missing scalar field but cannot replace a populated value without a matching structured Bottle observation or a second agreeing label image. Unstructured web results may inform review but cannot authorize the replacement. Do not propose an update solely for cask type, size, or fill. This does not mutate or approve catalog data.",
      ),
      parameters: nonStrictJsonSchema(UpdateBottleProposalArgsSchema),
      strict: false,
      execute: (args) =>
        collector.record(
          toStoredOperation("update_bottle", ToolCallPayloadSchema.parse(args)),
        ),
    }),
    tool({
      name: "propose_merge_bottles",
      description: proposalToolDescription(
        "Record a read-only proposal to retire one inspected duplicate Bottle into an inspected canonical survivor. Before calling, inspect both records and collect direct authoritative external product evidence of exact equivalence when available; cite that web result. Catalog agreement, an audit note, search rank, or an attached label alone is insufficient. This does not mutate or approve catalog data.",
      ),
      parameters: MergeBottlesProposalArgsSchema,
      execute: (args) =>
        collector.record(toStoredOperation("merge_bottles", args)),
    }),
    tool({
      name: "propose_update_entity",
      description: proposalToolDescription(
        "Record a read-only proposal to update one inspected Entity directly involved in representing the checked Bottle. Use only after collecting every cited piece of evidence. This does not mutate or approve catalog data.",
      ),
      parameters: nonStrictJsonSchema(UpdateEntityProposalArgsSchema),
      strict: false,
      execute: (args) =>
        collector.record(
          toStoredOperation("update_entity", ToolCallPayloadSchema.parse(args)),
        ),
    }),
    tool({
      name: "propose_merge_entities",
      description: proposalToolDescription(
        "Record a read-only proposal to retire one inspected duplicate Entity into an inspected canonical survivor directly related to the checked Bottle. This does not mutate or approve catalog data.",
      ),
      parameters: MergeEntitiesProposalArgsSchema,
      execute: (args) =>
        collector.record(toStoredOperation("merge_entities", args)),
    }),
  ];
}
