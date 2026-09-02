import { isAIGatewayConfigured } from "@peated/server/lib/openaiClient";
import { describe, expect, test } from "vitest";
import { createReviewClip } from "./clip";

describe.skipIf(!isAIGatewayConfigured("scraper"))(
  "external review clip eval",
  () => {
    test("creates a short tasting preview without sales facts", async () => {
      const clip = await createReviewClip(`
        This 12-year-old whisky is bottled at 46% ABV and scored 92/100.
        It costs $89.99. The nose brings coastal smoke and lemon oil.
        The palate adds baked apple and pepper before a long, dry finish.
        It is lively, balanced, and easy to recommend.
      `);

      expect(clip).not.toBeNull();
      expect(clip!.length).toBeLessThanOrEqual(180);
      expect(clip).not.toContain("\n");
      expect(clip).not.toMatch(/12-year-old|46%|92|\$89\.99/u);
    });

    test("returns no clip when the text has no review", async () => {
      const clip = await createReviewClip(`
        Home. About. Privacy policy. Cookie settings. Contact the publisher.
      `);

      expect(clip).toBeNull();
    });
  },
);
