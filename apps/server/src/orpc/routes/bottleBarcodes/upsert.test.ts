import { db } from "@peated/server/db";
import { bottleBarcodes } from "@peated/server/db/schema";
import { getUserActor } from "@peated/server/lib/actors";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { eq } from "drizzle-orm";

describe("bottle barcodes", () => {
  test("moderators add multiple normalized barcodes with actor provenance", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const moderator = await fixtures.User({ mod: true });
    const actor = await getUserActor(moderator);

    const first = await routerClient.bottleBarcodes.upsert(
      { bottle: bottle.id, barcode: "0 36602-30197 9", volume: 750 },
      { context: { user: moderator } },
    );
    const second = await routerClient.bottleBarcodes.upsert(
      { bottle: bottle.id, barcode: "96385074" },
      { context: { user: moderator } },
    );

    expect(first).toMatchObject({
      bottle: bottle.id,
      value: "036602301979",
      volume: 750,
    });
    expect(second).toMatchObject({
      bottle: bottle.id,
      value: "96385074",
    });
    await expect(
      db.query.bottleBarcodes.findFirst({
        where: eq(bottleBarcodes.id, first.id),
      }),
    ).resolves.toMatchObject({
      gtin14: "00036602301979",
      createdByActorId: actor.id,
    });
  });

  test("public clients list and resolve barcodes for an exact Bottle", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const moderator = await fixtures.User({ mod: true });
    await routerClient.bottleBarcodes.upsert(
      { bottle: bottle.id, barcode: "96385074" },
      { context: { user: moderator } },
    );
    await routerClient.bottleBarcodes.upsert(
      { bottle: bottle.id, barcode: "4006381333931" },
      { context: { user: moderator } },
    );

    await expect(
      routerClient.bottleBarcodes.list({ bottle: bottle.id }),
    ).resolves.toMatchObject({
      results: [
        { bottle: bottle.id, value: "4006381333931" },
        { bottle: bottle.id, value: "96385074" },
      ],
    });
    await expect(
      routerClient.bottleBarcodes.details({ barcode: "4006-3813-3393-1" }),
    ).resolves.toMatchObject({
      barcode: { bottle: bottle.id, value: "4006381333931" },
      bottle: { id: bottle.id, fullName: bottle.fullName },
    });
  });

  test("equivalent representations are idempotent for the same Bottle", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const moderator = await fixtures.User({ mod: true });

    const first = await routerClient.bottleBarcodes.upsert(
      { bottle: bottle.id, barcode: "036602301979" },
      { context: { user: moderator } },
    );
    const second = await routerClient.bottleBarcodes.upsert(
      { bottle: bottle.id, barcode: "0036602301979" },
      { context: { user: moderator } },
    );

    expect(second).toEqual(first);
    await expect(db.$count(bottleBarcodes)).resolves.toBe(1);
  });

  test("fills missing volume but rejects a conflicting volume", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const moderator = await fixtures.User({ mod: true });
    await routerClient.bottleBarcodes.upsert(
      { bottle: bottle.id, barcode: "036602301979" },
      { context: { user: moderator } },
    );

    await expect(
      routerClient.bottleBarcodes.upsert(
        { bottle: bottle.id, barcode: "0036602301979", volume: 750 },
        { context: { user: moderator } },
      ),
    ).resolves.toMatchObject({ volume: 750 });
    await expect(
      waitError(
        routerClient.bottleBarcodes.upsert(
          { bottle: bottle.id, barcode: "036602301979", volume: 700 },
          { context: { user: moderator } },
        ),
      ),
    ).resolves.toMatchObject({ status: 409 });
  });

  test("rejects assignment of one normalized GTIN to another Bottle", async ({
    fixtures,
  }) => {
    const firstBottle = await fixtures.Bottle();
    const secondBottle = await fixtures.Bottle();
    const moderator = await fixtures.User({ mod: true });
    await routerClient.bottleBarcodes.upsert(
      { bottle: firstBottle.id, barcode: "036602301979" },
      { context: { user: moderator } },
    );

    await expect(
      waitError(
        routerClient.bottleBarcodes.upsert(
          { bottle: secondBottle.id, barcode: "0036602301979" },
          { context: { user: moderator } },
        ),
      ),
    ).resolves.toMatchObject({
      status: 409,
      message: "Barcode is already assigned to another Bottle.",
    });
    await expect(db.$count(bottleBarcodes)).resolves.toBe(1);
  });

  test("rejects invalid barcodes and missing Bottles", async ({ fixtures }) => {
    const bottle = await fixtures.Bottle();
    const moderator = await fixtures.User({ mod: true });

    for (const barcode of ["1234567", "03660230197X", "036602301973"]) {
      await expect(
        waitError(
          routerClient.bottleBarcodes.upsert(
            { bottle: bottle.id, barcode },
            { context: { user: moderator } },
          ),
        ),
      ).resolves.toMatchObject({ status: 400 });
    }
    await expect(
      waitError(
        routerClient.bottleBarcodes.upsert(
          { bottle: 2_147_483_647, barcode: "96385074" },
          { context: { user: moderator } },
        ),
      ),
    ).resolves.toMatchObject({
      status: 404,
      message: "Bottle not found.",
    });
    await expect(db.$count(bottleBarcodes)).resolves.toBe(0);
  });

  test("requires moderator access for writes", async ({
    defaults,
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();

    await expect(
      waitError(
        routerClient.bottleBarcodes.upsert(
          { bottle: bottle.id, barcode: "96385074" },
          { context: { user: defaults.user } },
        ),
      ),
    ).resolves.toMatchObject({ status: 401 });
    await expect(
      waitError(
        routerClient.bottleBarcodes.delete(
          { barcode: "96385074" },
          { context: { user: defaults.user } },
        ),
      ),
    ).resolves.toMatchObject({ status: 401 });
    await expect(db.$count(bottleBarcodes)).resolves.toBe(0);
  });

  test("moderators remove mappings using an equivalent representation", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const moderator = await fixtures.User({ mod: true });
    await routerClient.bottleBarcodes.upsert(
      { bottle: bottle.id, barcode: "036602301979" },
      { context: { user: moderator } },
    );

    await expect(
      routerClient.bottleBarcodes.delete(
        { barcode: "0036602301979" },
        { context: { user: moderator } },
      ),
    ).resolves.toEqual({});
    await expect(
      waitError(
        routerClient.bottleBarcodes.details({ barcode: "036602301979" }),
      ),
    ).resolves.toMatchObject({
      status: 404,
      message: "Bottle barcode not found.",
    });
  });

  test("returns not found for unknown Bottles and barcodes", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();

    await expect(
      waitError(
        routerClient.bottleBarcodes.list({ bottle: bottle.id + 100_000 }),
      ),
    ).resolves.toMatchObject({
      status: 404,
      message: "Bottle not found.",
    });
    await expect(
      waitError(routerClient.bottleBarcodes.details({ barcode: "96385074" })),
    ).resolves.toMatchObject({
      status: 404,
      message: "Bottle barcode not found.",
    });
  });
});
