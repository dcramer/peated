import type { z } from "zod";
import waitError from "../../test/waitError";
import { createTastingForBadge } from "../testHelpers";
import { EntityCheck, EntityCheckConfigSchema } from "./entityCheck";

describe("config schema", () => {
  test("valid params", async () => {
    const config = {
      entity: 1,
      type: "distiller",
    };
    expect(await EntityCheckConfigSchema.parseAsync(config))
      .toMatchInlineSnapshot(`
      {
        "entity": 1,
        "type": "distiller",
      }
    `);
  });

  test("no type", async () => {
    const config = {
      entity: 1,
      type: null,
    };

    expect(await EntityCheckConfigSchema.parseAsync(config))
      .toMatchInlineSnapshot(`
      {
        "entity": 1,
        "type": null,
      }
    `);
  });

  test("no entity", async () => {
    const config = {
      type: null,
    };
    const err = await waitError(EntityCheckConfigSchema.parseAsync(config));
    expect(err).toMatchInlineSnapshot(`
      [ZodError: [
        {
          "expected": "number",
          "code": "invalid_type",
          "path": [
            "entity"
          ],
          "message": "Invalid input: expected number, received undefined"
        }
      ]]
    `);
  });
});

describe("test", () => {
  test("matches bottle with entityId on brand with any type", async ({
    fixtures,
  }) => {
    const brand = await fixtures.Entity({
      name: "Brand",
    });
    const tasting = await createTastingForBadge(fixtures, {
      distillers: [],
      brand,
    });

    const badgeImpl = new EntityCheck();
    const config = {
      entity: brand.id,
      type: null,
    } satisfies z.infer<typeof EntityCheckConfigSchema>;
    expect(badgeImpl.test(config, tasting)).toEqual(true);
  });

  test("matches bottle with entityId on brand with brand type", async ({
    fixtures,
  }) => {
    const brand = await fixtures.Entity({
      name: "Brand",
    });
    const tasting = await createTastingForBadge(fixtures, {
      distillers: [],
      brand,
    });

    const badgeImpl = new EntityCheck();
    const config = {
      entity: brand.id,
      type: "brand",
    } satisfies z.infer<typeof EntityCheckConfigSchema>;
    expect(badgeImpl.test(config, tasting)).toEqual(true);
  });

  test("does not match bottle with entityId on brand with distiller type", async ({
    fixtures,
  }) => {
    const brand = await fixtures.Entity({
      name: "Brand",
    });
    const tasting = await createTastingForBadge(fixtures, {
      distillers: [],
      brand,
    });

    const badgeImpl = new EntityCheck();
    const config = {
      entity: brand.id,
      type: "distiller",
    } satisfies z.infer<typeof EntityCheckConfigSchema>;
    expect(badgeImpl.test(config, tasting)).toEqual(false);
  });

  test("matches bottle with entityId on distiller with any type", async ({
    fixtures,
  }) => {
    const distiller = await fixtures.Entity({
      name: "Distiller",
    });
    const tasting = await createTastingForBadge(fixtures, {
      distillers: [distiller],
    });

    const badgeImpl = new EntityCheck();
    const config = {
      entity: distiller.id,
      type: null,
    } satisfies z.infer<typeof EntityCheckConfigSchema>;
    expect(badgeImpl.test(config, tasting)).toEqual(true);
  });

  test("matches bottle with entityId on distiller with distiller type", async ({
    fixtures,
  }) => {
    const distiller = await fixtures.Entity({
      name: "Distiller",
    });
    const tasting = await createTastingForBadge(fixtures, {
      distillers: [distiller],
    });

    const badgeImpl = new EntityCheck();
    const config = {
      entity: distiller.id,
      type: "distiller",
    } satisfies z.infer<typeof EntityCheckConfigSchema>;
    expect(badgeImpl.test(config, tasting)).toEqual(true);
  });

  test("does not match bottle with entityId on distiller with brand type", async ({
    fixtures,
  }) => {
    const distiller = await fixtures.Entity({
      name: "Distiller",
    });
    const tasting = await createTastingForBadge(fixtures, {
      distillers: [distiller],
    });

    const badgeImpl = new EntityCheck();
    const config = {
      entity: distiller.id,
      type: "brand",
    } satisfies z.infer<typeof EntityCheckConfigSchema>;
    expect(badgeImpl.test(config, tasting)).toEqual(false);
  });
});
