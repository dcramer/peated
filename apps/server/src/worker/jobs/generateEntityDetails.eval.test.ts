import { isAIGatewayConfigured } from "@peated/server/lib/openaiClient";
import { describe, expect, test } from "vitest";
import { getGeneratedEntityDetails } from "./generateEntityDetails";

// Respellings vary ("la-FROYG", "la-froyg"), so each case checks the sound
// of the stressed syllable rather than one exact spelling.
describe.skipIf(!isAIGatewayConfigured())("entity pronunciation", () => {
  // Wine Enthusiast and The Scotsman both give "la-froyg".
  test("says Laphroaig with a stressed 'froyg'", async () => {
    const result = await getGeneratedEntityDetails({
      name: "Laphroaig",
      kind: "distillery",
      country: { name: "Scotland" },
      region: { name: "Islay" },
    });

    expect(result?.pronunciation?.toLowerCase()).toContain("froy");
    expect(result?.pronunciationIpa).toBeTruthy();
  });

  // Wine Enthusiast gives "brook-LADDIE".
  test("says Bruichladdich with a stressed 'lad'", async () => {
    const result = await getGeneratedEntityDetails({
      name: "Bruichladdich",
      kind: "distillery",
      country: { name: "Scotland" },
      region: { name: "Islay" },
    });

    expect(result?.pronunciation?.toLowerCase()).toContain("lad");
    expect(result?.pronunciationIpa).toBeTruthy();
  });
});
