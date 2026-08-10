import { RunContext } from "@openai/agents";
import { describe, expect, test, vi } from "vitest";

import type { BottleCandidate } from "../classifierTypes";
import { createSearchBottlesTool } from "./searchBottles";

const candidate: BottleCandidate = {
  bottleId: 45146,
  alias: "Laphroaig Cairdeas 2022",
  fullName: "Laphroaig Càirdeas 2022 Warehouse 1",
  brand: "Laphroaig",
  bottler: null,
  series: "Càirdeas",
  distillery: ["Laphroaig"],
  category: "single_malt",
  statedAge: null,
  edition: "Warehouse 1",
  caskStrength: true,
  singleCask: false,
  caskType: null,
  caskSize: null,
  caskFill: null,
  abv: 52.2,
  vintageYear: null,
  releaseYear: 2022,
  score: 0.98,
  source: ["exact"],
};

describe("search_bottles tool", () => {
  test("keeps retrieval metadata in the runtime and out of agent evidence", async () => {
    const searchBottles = vi.fn(async () => [candidate]);
    const onResults = vi.fn();
    const tool = createSearchBottlesTool({ searchBottles, onResults });

    const result = await tool.invoke(
      new RunContext(),
      JSON.stringify({ query: "Laphroaig Cairdeas 2022" }),
    );
    const agentEvidence = result as unknown as {
      results: Array<Record<string, unknown>>;
    };

    expect(onResults).toHaveBeenCalledWith([candidate]);
    expect(agentEvidence).toMatchObject({
      results: [{ bottleId: 45146 }],
    });
    expect(agentEvidence.results[0]).not.toHaveProperty("score");
    expect(agentEvidence.results[0]).not.toHaveProperty("source");
  });
});
