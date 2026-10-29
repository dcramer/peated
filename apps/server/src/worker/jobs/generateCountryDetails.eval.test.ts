import { isAIGatewayConfigured } from "@peated/server/lib/openaiClient";
import { describe, expect, test } from "vitest";
import { getGeneratedCountryDetails } from "./generateCountryDetails";

function paragraphs(text: string | null | undefined) {
  return (text ?? "").split(/\n+/).filter((line) => line.trim());
}

describe.skipIf(!isAIGatewayConfigured())("country details", () => {
  // The Scotch Whisky Regulations 2009 require at least three years in oak
  // casks in Scotland.
  test("names Scotland's legal minimum age and spells it 'whisky'", async () => {
    const result = await getGeneratedCountryDetails({
      name: "Scotland",
      slug: "scotland",
    });

    expect(result?.summary).toMatch(/three years|3 years/i);
    expect(paragraphs(result?.description).length).toBeGreaterThanOrEqual(2);
    expect(paragraphs(result?.description).length).toBeLessThanOrEqual(3);
    expect(`${result?.summary} ${result?.description}`).not.toMatch(/whiskey/i);
  });

  // The United States sets federal standards of identity for whiskey.
  test("summarizes the United States' production rules", async () => {
    const result = await getGeneratedCountryDetails({
      name: "United States",
      slug: "united-states",
    });

    expect(result?.summary).toBeTruthy();
    expect(paragraphs(result?.description).length).toBeGreaterThanOrEqual(2);
    expect(paragraphs(result?.description).length).toBeLessThanOrEqual(3);
  });
});
