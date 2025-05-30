import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { describe, expect, test } from "vitest";

describe("PATCH /tags/:name", () => {
  test("requires authentication", async ({ fixtures }) => {
    const tag = await fixtures.Tag();
    const err = await waitError(() =>
      routerClient.tags.update({
        tag: tag.name,
      }),
    );
    expect(err).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });

  test("requires mod privileges", async ({ fixtures }) => {
    const tag = await fixtures.Tag();
    const user = await fixtures.User();

    const err = await waitError(() =>
      routerClient.tags.update(
        {
          tag: tag.name,
        },
        { context: { user } },
      ),
    );
    expect(err).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });

  test("returns 404 for non-existent tag", async ({ fixtures }) => {
    const user = await fixtures.User({ mod: true });

    const err = await waitError(() =>
      routerClient.tags.update(
        {
          tag: "non-existent-tag",
        },
        { context: { user } },
      ),
    );
    expect(err).toMatchInlineSnapshot(`[Error: Tag not found.]`);
  });

  test("updates tag category", async ({ fixtures }) => {
    const tag = await fixtures.Tag({ tagCategory: "peaty" });
    const user = await fixtures.User({ admin: true });

    const newTag = await routerClient.tags.update(
      {
        tag: tag.name,
        tagCategory: "fruity",
      },
      { context: { user } },
    );

    expect(newTag).toBeDefined();
    expect(newTag.tagCategory).toEqual("fruity");
  });

  test("updates tag synonyms", async ({ fixtures }) => {
    const tag = await fixtures.Tag({ synonyms: ["old-synonym"] });
    const user = await fixtures.User({ admin: true });

    const newTag = await routerClient.tags.update(
      {
        tag: tag.name,
        synonyms: ["new-synonym"],
      },
      { context: { user } },
    );

    expect(newTag).toBeDefined();
    expect(newTag.synonyms).toEqual(["new-synonym"]);
  });

  test("no-op when no changes", async ({ fixtures }) => {
    const tag = await fixtures.Tag({ tagCategory: "peaty" });
    const user = await fixtures.User({ admin: true });

    const newTag = await routerClient.tags.update(
      {
        tag: tag.name,
      },
      { context: { user } },
    );

    expect(newTag).toBeDefined();
    expect(newTag.tagCategory).toEqual("peaty");
  });
});
