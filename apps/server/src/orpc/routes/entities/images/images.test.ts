import { MAX_FILESIZE } from "@peated/server/constants";
import { db } from "@peated/server/db";
import { entityImages } from "@peated/server/db/schema";
import { getUserActor } from "@peated/server/lib/actors";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { asc, eq } from "drizzle-orm";

describe("Entity images", () => {
  test("requires authentication", async ({ fixtures }) => {
    const entity = await fixtures.Entity();
    const err = await waitError(
      routerClient.entities.images.create({
        entity: entity.id,
        file: await fixtures.SampleSquareImage(),
        idempotencyKey: "requires-authentication",
      }),
    );

    expect(err).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });

  test("rejects the Entity creator without moderator access", async ({
    fixtures,
  }) => {
    const owner = await fixtures.User();
    const ownerActor = await getUserActor(owner);
    const entity = await fixtures.Entity({ createdByActorId: ownerActor.id });
    const err = await waitError(
      routerClient.entities.images.create(
        {
          entity: entity.id,
          file: await fixtures.SampleSquareImage(),
          idempotencyKey: "creator-image",
        },
        { context: { user: owner } },
      ),
    );

    expect(err).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });

  test("adds captioned images and keeps one primary image", async ({
    fixtures,
  }) => {
    const entity = await fixtures.Entity();
    const mod = await fixtures.User({ mod: true });

    const first = await routerClient.entities.images.create(
      {
        entity: entity.id,
        file: await fixtures.SampleSquareImage(),
        caption: "Original distillery building",
        idempotencyKey: "first-image",
      },
      { context: { user: mod } },
    );
    const retriedFirst = await routerClient.entities.images.create(
      {
        entity: entity.id,
        file: await fixtures.SampleSquareImage(),
        caption: "Ignored retry caption",
        idempotencyKey: "first-image",
      },
      { context: { user: mod } },
    );
    const second = await routerClient.entities.images.create(
      {
        entity: entity.id,
        file: await fixtures.SampleSquareImage(),
        caption: "Visitor entrance",
        idempotencyKey: "second-image",
      },
      { context: { user: mod } },
    );

    expect(first).toMatchObject({
      entityId: entity.id,
      caption: "Original distillery building",
      isPrimary: true,
    });
    expect(retriedFirst.id).toBe(first.id);
    expect(second.isPrimary).toBe(false);

    const promoted = await routerClient.entities.images.update(
      {
        entity: entity.id,
        image: second.id,
        caption: "Main visitor entrance",
        makePrimary: true,
      },
      { context: { user: mod } },
    );
    expect(promoted).toMatchObject({
      caption: "Main visitor entrance",
      isPrimary: true,
    });

    const rows = await db
      .select()
      .from(entityImages)
      .where(eq(entityImages.entityId, entity.id))
      .orderBy(asc(entityImages.id));
    expect(rows.map(({ id, isPrimary }) => ({ id, isPrimary }))).toEqual([
      { id: first.id, isPrimary: false },
      { id: second.id, isPrimary: true },
    ]);

    const details = await routerClient.entities.details({ entity: entity.id });
    expect(details.images.map(({ id }) => id)).toEqual([second.id, first.id]);
  });

  test("promotes another image when the primary image is deleted", async ({
    fixtures,
  }) => {
    const entity = await fixtures.Entity();
    const mod = await fixtures.User({ mod: true });
    const primary = await routerClient.entities.images.create(
      {
        entity: entity.id,
        file: await fixtures.SampleSquareImage(),
        idempotencyKey: "primary-image",
      },
      { context: { user: mod } },
    );
    const secondary = await routerClient.entities.images.create(
      {
        entity: entity.id,
        file: await fixtures.SampleSquareImage(),
        idempotencyKey: "secondary-image",
      },
      { context: { user: mod } },
    );

    await routerClient.entities.images.delete(
      { entity: entity.id, image: primary.id },
      { context: { user: mod } },
    );

    const [remaining] = await db
      .select()
      .from(entityImages)
      .where(eq(entityImages.entityId, entity.id));
    expect(remaining).toMatchObject({ id: secondary.id, isPrimary: true });
  });

  test("does not update an image through another entity", async ({
    fixtures,
  }) => {
    const entity = await fixtures.Entity();
    const otherEntity = await fixtures.Entity();
    const mod = await fixtures.User({ mod: true });
    const image = await routerClient.entities.images.create(
      {
        entity: entity.id,
        file: await fixtures.SampleSquareImage(),
        idempotencyKey: "image-for-other-entity-check",
      },
      { context: { user: mod } },
    );

    const err = await waitError(
      routerClient.entities.images.update(
        {
          entity: otherEntity.id,
          image: image.id,
          caption: "Wrong entity",
        },
        { context: { user: mod } },
      ),
    );
    expect(err).toMatchInlineSnapshot(`[Error: Image not found.]`);
  });

  test("rejects oversized images", async ({ fixtures }) => {
    const entity = await fixtures.Entity();
    const mod = await fixtures.User({ mod: true });
    const err = await waitError(
      routerClient.entities.images.create(
        {
          entity: entity.id,
          file: new Blob([new Uint8Array(MAX_FILESIZE + 1)]),
          idempotencyKey: "oversized-image",
        },
        { context: { user: mod } },
      ),
    );

    expect(err).toMatchInlineSnapshot(
      `[Error: File exceeded maximum upload size of 20.0 MiB.]`,
    );
  });
});
