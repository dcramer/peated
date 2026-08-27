import type { z } from "zod";
import waitError from "../../test/waitError";
import { createTastingForBadge } from "../testHelpers";
import { EntityCheck, EntityCheckConfigSchema } from "./entityCheck";

describe("config schema", () => {
  test("valid params", async () => {
    const config = {
      entity: 1,
      role: "distiller",
    };
    expect(await EntityCheckConfigSchema.parseAsync(config))
      .toMatchInlineSnapshot(`
      {
        "entity": 1,
        "role": "distiller",
      }
    `);
  });

  test("no type", async () => {
    const config = {
      entity: 1,
      role: null,
    };

    expect(await EntityCheckConfigSchema.parseAsync(config))
      .toMatchInlineSnapshot(`
      {
        "entity": 1,
        "role": null,
      }
    `);
  });

  test("no entity", async () => {
    const config = {
      role: null,
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
      role: null,
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
      role: "brand",
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
      role: "distiller",
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
      role: null,
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
      role: "distiller",
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
      role: "brand",
    } satisfies z.infer<typeof EntityCheckConfigSchema>;
    expect(badgeImpl.test(config, tasting)).toEqual(false);
  });
});
