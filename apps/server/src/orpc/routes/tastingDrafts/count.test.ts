import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { describe, expect, test } from "vitest";

describe("GET /tasting-drafts/count", () => {
  test("requires auth", async () => {
    const error = await waitError(() => routerClient.tastingDrafts.count());
    expect(error).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });

  test("counts only my drafts", async ({ defaults, fixtures }) => {
    await fixtures.TastingDraft({ createdById: defaults.user.id });
    await fixtures.TastingDraft({ createdById: defaults.user.id });
    await fixtures.TastingDraft();

    const result = await routerClient.tastingDrafts.count(undefined, {
      context: { user: defaults.user },
    });

    expect(result).toEqual({ count: 2 });
  });
});
