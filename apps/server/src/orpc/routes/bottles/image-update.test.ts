import config from "@peated/server/config";
import { db } from "@peated/server/db";
import { bottleImages } from "@peated/server/db/schema";
import { getUserActor } from "@peated/server/lib/actors";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { eq } from "drizzle-orm";
import path from "path";
import sharp from "sharp";

describe("POST /bottles/:bottle/image", () => {
  test("cannot update another user's bottle", async ({ fixtures }) => {
    const user = await fixtures.User();
    const otherUser = await fixtures.User();
    const otherActor = await getUserActor(otherUser);
    const bottle = await fixtures.Bottle({
      createdByActorId: otherActor.id,
    });

    const err = await waitError(
      routerClient.bottles.imageUpdate(
        {
          bottle: bottle.id,
          file: await fixtures.SampleSquareImage(),
        },
        {
          context: { user },
        },
      ),
    );
    expect(err).toMatchInlineSnapshot(
      `[Error: You don't have permission to update this bottle.]`,
    );
  });

  test("can update another user's bottle as mod", async ({ fixtures }) => {
    const user = await fixtures.User({ mod: true });
    const otherUser = await fixtures.User();
    const otherActor = await getUserActor(otherUser);
    const bottle = await fixtures.Bottle({
      createdByActorId: otherActor.id,
    });

    const response = await routerClient.bottles.imageUpdate(
      {
        bottle: bottle.id,
        file: await fixtures.SampleSquareImage(),
        sourceUrl: "https://example.com/bottle-photo",
        license: "CC BY 4.0",
      },
      {
        context: { user },
      },
    );

    expect(response.imageUrl).toBeDefined();
    expect(response).toMatchObject({
      sourceUrl: "https://example.com/bottle-photo",
      license: "CC BY 4.0",
    });
    await expect(
      db.query.bottleImages.findFirst({
        where: (images, { and, eq }) =>
          and(eq(images.bottleId, bottle.id), eq(images.isPrimary, true)),
      }),
    ).resolves.toMatchObject({
      sourceUrl: "https://example.com/bottle-photo",
      license: "CC BY 4.0",
      createdByActorId: (await getUserActor(user)).id,
    });
  });

  test("bottle image does resize down", async ({ fixtures, defaults }) => {
    const actor = await getUserActor(defaults.user);
    const bottle = await fixtures.Bottle({
      createdByActorId: actor.id,
      imageUrl: "https://example.com/old-photo.jpg",
    });
    const [oldImage] = await db
      .insert(bottleImages)
      .values({
        bottleId: bottle.id,
        imageUrl: bottle.imageUrl!,
        sourceUrl: "https://example.com/old-photo",
        license: "CC BY 2.0",
        isPrimary: true,
        createdByActorId: actor.id,
      })
      .returning();

    const response = await routerClient.bottles.imageUpdate(
      {
        bottle: bottle.id,
        file: await fixtures.SampleSquareImage(),
      },
      {
        context: { user: defaults.user },
      },
    );

    expect(response.imageUrl).toBeDefined();
    expect(response).toMatchObject({ sourceUrl: null, license: null });
    await expect(
      db.query.bottleImages.findFirst({
        where: (images, { and, eq }) =>
          and(eq(images.bottleId, bottle.id), eq(images.isPrimary, true)),
      }),
    ).resolves.toMatchObject({ sourceUrl: null, license: null });
    await expect(
      db.query.bottleImages.findFirst({
        where: eq(bottleImages.id, oldImage.id),
      }),
    ).resolves.toMatchObject({ isPrimary: false });
    expect(path.extname(response.imageUrl)).toBe(".webp");

    // Verify the image was resized correctly
    const filepath = `${config.UPLOAD_PATH}/${path.basename(response.imageUrl)}`;
    const metadata = await sharp(filepath).metadata();
    expect(metadata.format).toBe("webp");
    expect(metadata.height).toBeLessThanOrEqual(1024);
    expect(metadata.width).toBeLessThanOrEqual(1024);
  });

  test("updates the source and license without replacing the image", async ({
    fixtures,
    defaults,
  }) => {
    const actor = await getUserActor(defaults.user);
    const bottle = await fixtures.Bottle({
      createdByActorId: actor.id,
      imageUrl: "https://example.com/current-photo.jpg",
    });
    const [image] = await db
      .insert(bottleImages)
      .values({
        bottleId: bottle.id,
        imageUrl: bottle.imageUrl!,
        isPrimary: true,
        createdByActorId: actor.id,
      })
      .returning();

    const response = await routerClient.bottles.imageUpdate(
      {
        bottle: bottle.id,
        sourceUrl: "https://example.com/current-photo",
        license: "Used with permission",
      },
      { context: { user: defaults.user } },
    );

    expect(response).toMatchObject({
      imageUrl: bottle.imageUrl,
      sourceUrl: "https://example.com/current-photo",
      license: "Used with permission",
    });
    await expect(
      db.query.bottleImages.findFirst({
        where: eq(bottleImages.id, image.id),
      }),
    ).resolves.toMatchObject({
      sourceUrl: "https://example.com/current-photo",
      license: "Used with permission",
      isPrimary: true,
    });

    const clearedLicense = await routerClient.bottles.imageUpdate(
      { bottle: bottle.id, license: null },
      { context: { user: defaults.user } },
    );
    expect(clearedLicense).toMatchObject({
      sourceUrl: "https://example.com/current-photo",
      license: null,
    });
  });
});
