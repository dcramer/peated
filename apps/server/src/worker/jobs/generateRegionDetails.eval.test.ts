import { isAIGatewayConfigured } from "@peated/server/lib/openaiClient";
import type { Country } from "@peated/server/types";
import { describe, expect, test } from "vitest";
import { getGeneratedRegionDetails } from "./generateRegionDetails";

function country(id: number, name: string, slug: string): Country {
  return { id, name, slug, totalBottles: 0, totalDistillers: 0 };
}

function paragraphs(text: string | null | undefined) {
  return (text ?? "").split(/\n+/).filter((line) => line.trim());
}

describe.skipIf(!isAIGatewayConfigured())("region details", () => {
  test("describes Islay in two paragraphs and mentions peat", async () => {
    const result = await getGeneratedRegionDetails({
      name: "Islay",
      slug: "islay",
      country: country(1, "Scotland", "scotland"),
    });

    expect(paragraphs(result?.description)).toHaveLength(2);
    expect(result?.description).toMatch(/peat/i);
  });

  test("describes Kentucky in two paragraphs and mentions bourbon", async () => {
    const result = await getGeneratedRegionDetails({
      name: "Kentucky",
      slug: "kentucky",
      country: country(2, "United States", "united-states"),
    });

    expect(paragraphs(result?.description)).toHaveLength(2);
    expect(result?.description).toMatch(/bourbon/i);
  });
});
