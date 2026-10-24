import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";

describe("entity About notes", () => {
  test("adds, lists, and removes notes", async ({ fixtures }) => {
    const user = await fixtures.User({ mod: true });
    const entity = await fixtures.Entity();

    const note = await routerClient.entities.about.notes.create(
      {
        entity: entity.id,
        text: "Two distilleries have used the Clynelish name.",
        sourceUrl: "https://example.com/clynelish",
      },
      { context: { user } },
    );
    expect(
      await routerClient.entities.about.notes.list(
        { entity: entity.id },
        { context: { user } },
      ),
    ).toMatchObject({
      results: [
        {
          id: note.id,
          text: "Two distilleries have used the Clynelish name.",
          sourceUrl: "https://example.com/clynelish",
        },
      ],
    });

    await routerClient.entities.about.notes.delete(
      { entity: entity.id, note: note.id },
      { context: { user } },
    );
    expect(
      await routerClient.entities.about.notes.list(
        { entity: entity.id },
        { context: { user } },
      ),
    ).toEqual({ results: [] });
  });

  test("removes a note only from its own entity", async ({ fixtures }) => {
    const user = await fixtures.User({ mod: true });
    const entity = await fixtures.Entity();
    const other = await fixtures.Entity();
    const note = await routerClient.entities.about.notes.create(
      { entity: entity.id, text: "A note." },
      { context: { user } },
    );

    const err = await waitError(() =>
      routerClient.entities.about.notes.delete(
        { entity: other.id, note: note.id },
        { context: { user } },
      ),
    );

    expect(err).toMatchInlineSnapshot(`[Error: Note not found.]`);
  });

  test("requires moderator privileges", async ({ fixtures }) => {
    const user = await fixtures.User();
    const entity = await fixtures.Entity();

    const err = await waitError(() =>
      routerClient.entities.about.notes.create(
        { entity: entity.id, text: "A note." },
        { context: { user } },
      ),
    );

    expect(err).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });
});
