import { RunContext } from "@openai/agents";
import { describe, expect, test } from "vitest";
import { z } from "zod";

import {
  createBottleProposalCollector,
  createBottleProposalTools,
} from "./proposeOperations";

const ToolInputSchema = z.json();
type ToolInput = z.infer<typeof ToolInputSchema>;

type SpoofedOperationCase = {
  toolName: string;
  spoofedType: string;
  input: ToolInput;
  evidenceRefs: ToolInput[];
};

function createHarness() {
  const inspectedBottleIds = new Set([10, 11]);
  const inspectedEntityIds = new Set([20, 21]);
  const collector = createBottleProposalCollector({
    context: {
      hasBottleEvidence: (bottleId) => inspectedBottleIds.has(bottleId),
      hasEntityEvidence: (entityId) => inspectedEntityIds.has(entityId),
      hasSourceEvidence: (field) => field === "reference.name",
      hasWebEvidence: (url) => url === "https://example.com/evidence",
      isBottleInspected: (bottleId) => inspectedBottleIds.has(bottleId),
      isEntityInspected: (entityId) => inspectedEntityIds.has(entityId),
      isSeriesInspected: (seriesId) => seriesId === 71,
      getBottleBranding: (bottleId) =>
        bottleId === 10
          ? {
              brand: "The Scotch Malt Whisky Society",
              bottler: "The Scotch Malt Whisky Society",
            }
          : { brand: "Example Distillery", bottler: null },
      getUnsupportedPopulatedBottlePatchField: () => null,
    },
  });
  return {
    collector,
    tools: createBottleProposalTools(collector),
  };
}

async function invoke(
  tools: ReturnType<typeof createBottleProposalTools>,
  name: string,
  input: ToolInput,
) {
  const selected = tools.find((candidate) => candidate.name === name);
  if (!selected || selected.type !== "function") {
    throw new Error(`Tool ${name} was not found.`);
  }
  return await selected.invoke(new RunContext(), JSON.stringify(input));
}

describe("Bottle proposal tools", () => {
  test("exposes four non-mutating typed proposal tools", () => {
    const { tools } = createHarness();

    expect(tools.map(({ name }) => name)).toEqual([
      "propose_update_bottle",
      "propose_merge_bottles",
      "propose_update_entity",
      "propose_merge_entities",
    ]);
    expect(tools.map(({ strict }) => strict)).toEqual([
      false,
      true,
      false,
      true,
    ]);
    for (const proposalTool of tools) {
      expect(proposalTool.description).toContain("recorded | updated");
      expect(proposalTool.description).toContain("status: rejected");
      expect(proposalTool.description).toContain("reason");
      expect(JSON.stringify(proposalTool.parameters)).not.toContain('"input"');
    }

    const mergeTool = tools.find(
      ({ name }) => name === "propose_merge_bottles",
    );
    expect(mergeTool?.description).toContain("inspect both records");
    expect(mergeTool?.description).toContain(
      "authoritative external product evidence",
    );
    expect(mergeTool?.description).toContain("when available");
    expect(mergeTool?.description).toContain("alone is insufficient");
    expect(mergeTool?.parameters).toMatchObject({
      properties: {
        sourceBottleId: expect.anything(),
        destinationBottleId: expect.anything(),
        rationale: expect.anything(),
        evidenceRefs: expect.anything(),
      },
    });
  });

  test.each<SpoofedOperationCase>([
    {
      toolName: "propose_update_bottle",
      spoofedType: "merge_bottles",
      input: { sourceBottleId: 10, destinationBottleId: 11 },
      evidenceRefs: [
        { kind: "bottle", bottleId: 10 },
        { kind: "bottle", bottleId: 11 },
      ],
    },
    {
      toolName: "propose_update_entity",
      spoofedType: "merge_entities",
      input: { sourceEntityId: 20, destinationEntityId: 21 },
      evidenceRefs: [
        { kind: "entity", entityId: 20 },
        { kind: "entity", entityId: 21 },
      ],
    },
  ])(
    "does not allow $toolName to override its operation type",
    async (testCase) => {
      const { collector, tools } = createHarness();

      expect(
        await invoke(tools, testCase.toolName, {
          type: testCase.spoofedType,
          input: testCase.input,
          rationale: "Attempt to cross the typed proposal-tool boundary.",
          evidenceRefs: testCase.evidenceRefs,
        }),
      ).toMatchObject({ status: "rejected" });
      expect(collector.getProposals()).toEqual([]);
    },
  );

  test("records inspected proposals and updates repeated type plus input", async () => {
    const { collector, tools } = createHarness();
    const proposal = {
      sourceBottleId: 10,
      destinationBottleId: 11,
      rationale: "Both inspected records are the exact same marketed Bottle.",
      evidenceRefs: [
        { kind: "bottle", bottleId: 10 },
        { kind: "bottle", bottleId: 11 },
      ],
    };

    expect(
      await invoke(tools, "propose_merge_bottles", proposal),
    ).toMatchObject({ status: "recorded", proposalIndex: 0 });
    expect(
      await invoke(tools, "propose_merge_bottles", {
        ...proposal,
        rationale: "Updated rationale for the same operation.",
        evidenceRefs: [
          { kind: "bottle", bottleId: 10 },
          { kind: "bottle", bottleId: 11 },
          { kind: "web_result", url: "https://example.com/evidence" },
        ],
      }),
    ).toMatchObject({ status: "updated", proposalIndex: 0 });
    expect(collector.getProposals()).toEqual([
      expect.objectContaining({
        rationale: "Updated rationale for the same operation.",
        evidenceRefs: expect.arrayContaining([
          { kind: "web_result", url: "https://example.com/evidence" },
        ]),
      }),
    ]);
  });

  test("rejects uninspected targets and uncollected evidence", async () => {
    const { collector, tools } = createHarness();

    expect(
      await invoke(tools, "propose_update_entity", {
        entityId: 99,
        patch: { website: "https://example.com" },
        rationale: "The Entity needs its official website.",
        evidenceRefs: [{ kind: "source", field: "reference.name" }],
      }),
    ).toMatchObject({ status: "rejected" });
    expect(
      await invoke(tools, "propose_update_bottle", {
        bottleId: 10,
        patch: { abv: 46 },
        rationale: "The inspected Bottle has the wrong ABV.",
        evidenceRefs: [
          { kind: "web_result", url: "https://example.com/not-collected" },
        ],
      }),
    ).toMatchObject({ status: "rejected" });
    expect(collector.getProposals()).toEqual([]);
  });

  test("rejects cask-metadata-only Bottle updates but keeps mixed updates compatible", async () => {
    const { collector, tools } = createHarness();
    const evidenceRefs = [{ kind: "bottle" as const, bottleId: 10 }];

    expect(
      await invoke(tools, "propose_update_bottle", {
        bottleId: 10,
        patch: {
          caskType: "oloroso",
          caskSize: "hogshead",
          caskFill: "1st_fill",
        },
        rationale: "Fill optional cask metadata.",
        evidenceRefs,
      }),
    ).toEqual({
      status: "rejected",
      reason:
        "Bottle updates cannot change only optional cask type, size, or fill metadata.",
    });

    expect(
      await invoke(tools, "propose_update_bottle", {
        bottleId: 10,
        patch: { abv: 46, caskType: "oloroso" },
        rationale: "Correct the ABV while preserving supplied cask metadata.",
        evidenceRefs,
      }),
    ).toMatchObject({ status: "recorded", proposalIndex: 0 });
    expect(collector.getProposals()).toEqual([
      expect.objectContaining({
        input: {
          bottleId: 10,
          patch: { abv: 46, caskType: "oloroso" },
        },
      }),
    ]);
  });

  test("returns the evidence boundary reason for an unsupported populated-field replacement", async () => {
    const inspectedBottleIds = new Set([10]);
    const collector = createBottleProposalCollector({
      context: {
        hasBottleEvidence: (bottleId) => inspectedBottleIds.has(bottleId),
        hasEntityEvidence: () => false,
        hasSourceEvidence: () => false,
        hasWebEvidence: () => false,
        isBottleInspected: (bottleId) => inspectedBottleIds.has(bottleId),
        isEntityInspected: () => false,
        isSeriesInspected: () => false,
        getBottleBranding: () => ({
          brand: "Example Distillery",
          bottler: null,
        }),
        getUnsupportedPopulatedBottlePatchField: () => "abv",
      },
    });
    const tools = createBottleProposalTools(collector);

    expect(
      await invoke(tools, "propose_update_bottle", {
        bottleId: 10,
        patch: { abv: 56.4 },
        rationale: "A single label extraction contradicts the stored ABV.",
        evidenceRefs: [{ kind: "bottle", bottleId: 10 }],
      }),
    ).toEqual({
      status: "rejected",
      reason:
        'Changing populated Bottle field "abv" requires a matching structured Bottle observation or two agreeing label images. Unstructured web results and one image extraction cannot overwrite an existing value.',
    });
    expect(collector.getProposals()).toEqual([]);
  });

  test("rejects an SMWS cask code as edition while keeping the other exact repairs", async () => {
    const { collector, tools } = createHarness();
    const evidenceRefs = [{ kind: "bottle" as const, bottleId: 10 }];

    expect(
      await invoke(tools, "propose_update_bottle", {
        bottleId: 10,
        patch: {
          edition: "95.71",
          abv: 57,
          singleCask: true,
          vintageYear: 2007,
        },
        rationale: "Add the verified exact Bottle traits.",
        evidenceRefs,
      }),
    ).toEqual({
      status: "rejected",
      reason:
        "SMWS exact-cask codes belong in the Bottle name, not the edition field. Omit the edition field from this proposal.",
    });
    expect(collector.getProposals()).toEqual([]);

    expect(
      await invoke(tools, "propose_update_bottle", {
        bottleId: 10,
        patch: {
          abv: 57,
          singleCask: true,
          vintageYear: 2007,
        },
        rationale: "Add the verified exact Bottle traits.",
        evidenceRefs,
      }),
    ).toMatchObject({ status: "recorded", proposalIndex: 0 });
    expect(collector.getProposals()).toEqual([
      expect.objectContaining({
        input: {
          bottleId: 10,
          patch: {
            abv: 57,
            singleCask: true,
            vintageYear: 2007,
          },
        },
      }),
    ]);
  });

  test("does not apply SMWS field placement to other exact-cask programs", async () => {
    const { collector, tools } = createHarness();

    expect(
      await invoke(tools, "propose_update_bottle", {
        bottleId: 11,
        patch: { edition: "10.258" },
        rationale: "Add the marketed release code.",
        evidenceRefs: [{ kind: "bottle", bottleId: 11 }],
      }),
    ).toMatchObject({ status: "recorded", proposalIndex: 0 });
    expect(collector.getProposals()).toHaveLength(1);
  });

  test("requires evidence refs for every existing operation target", async () => {
    const { collector, tools } = createHarness();

    expect(
      await invoke(tools, "propose_merge_bottles", {
        sourceBottleId: 10,
        destinationBottleId: 11,
        rationale: "Both rows are the same marketed Bottle.",
        evidenceRefs: [{ kind: "bottle", bottleId: 10 }],
      }),
    ).toMatchObject({
      status: "rejected",
      reason: expect.stringContaining('"bottleId":11'),
    });
    expect(
      await invoke(tools, "propose_update_bottle", {
        bottleId: 10,
        patch: {
          brand: { kind: "existing", entityId: 20 },
        },
        rationale: "Use the inspected canonical Brand.",
        evidenceRefs: [{ kind: "bottle", bottleId: 10 }],
      }),
    ).toMatchObject({
      status: "rejected",
      reason: expect.stringContaining('"entityId":20'),
    });
    expect(collector.getProposals()).toEqual([]);
  });

  test("requires Bottle context that exposes an assigned Series", async () => {
    const { collector, tools } = createHarness();
    const updateTool = tools.find(
      (tool) => tool.name === "propose_update_bottle",
    );

    expect(JSON.stringify(updateTool?.parameters)).toContain("seriesId");

    expect(
      await invoke(tools, "propose_update_bottle", {
        bottleId: 10,
        patch: { seriesId: 72 },
        rationale: "Assign a Series that no inspected Bottle exposes.",
        evidenceRefs: [{ kind: "bottle", bottleId: 10 }],
      }),
    ).toMatchObject({
      status: "rejected",
      reason: "BottleSeries 72 was not inspected.",
    });

    expect(
      await invoke(tools, "propose_update_bottle", {
        bottleId: 10,
        patch: { seriesId: 71 },
        rationale: "An inspected Bottle exposes the canonical Series.",
        evidenceRefs: [{ kind: "bottle", bottleId: 10 }],
      }),
    ).toMatchObject({ status: "recorded", proposalIndex: 0 });
    expect(collector.getProposals()).toEqual([
      expect.objectContaining({
        input: expect.objectContaining({
          patch: { seriesId: 71 },
        }),
      }),
    ]);
  });
});
