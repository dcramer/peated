import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { describe, expect, test } from "vitest";

describe("GET /tasting-drafts/{draft}", () => {
  test("requires auth", async ({ fixtures }) => {
    const draft = await fixtures.TastingDraft();
    const error = await waitError(() =>
      routerClient.tastingDrafts.details({ draft: draft.id }),
    );
    expect(error).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });

  test("returns my draft", async ({ defaults, fixtures }) => {
    const draft = await fixtures.TastingDraft({
      createdById: defaults.user.id,
      bottleHint: "the one with the blue label",
      notes: "smoke and pear",
    });

    const result = await routerClient.tastingDrafts.details(
      { draft: draft.id },
      { context: { user: defaults.user } },
    );

    expect(result).toMatchObject({
      id: draft.id,
      bottleHint: "the one with the blue label",
      notes: "smoke and pear",
      tastedAt: draft.tastedAt.toISOString(),
    });
  });

  test("hides another member's draft", async ({ defaults, fixtures }) => {
    const draft = await fixtures.TastingDraft();

    const error = await waitError(() =>
      routerClient.tastingDrafts.details(
        { draft: draft.id },
        { context: { user: defaults.user } },
      ),
    );

    expect(error).toMatchInlineSnapshot(`[Error: Draft not found.]`);
  });
});
