import type { z } from "zod";
import waitError from "../../test/waitError";
import { createTastingForBadge } from "../testHelpers";
import { EntityCheck } from "./entityCheck/check";

describe("parseConfig", () => {
  test("valid params", async () => {
    const badgeImpl = new EntityCheck();
    const config = {
      entityId: 1,
      type: "distiller",
    };
    expect(await badgeImpl.parseConfig(config)).toMatchInlineSnapshot(`
      {
        "entityId": 1,
        "type": "distiller",
      }
    `);
  });

  test("no type", async () => {
    const badgeImpl = new EntityCheck();
    const config = {
      entityId: 1,
      type: null,
    };

    expect(await badgeImpl.parseConfig(config)).toMatchInlineSnapshot(`
      {
        "entityId": 1,
        "type": null,
      }
    `);
  });

  test("no entityId", async () => {
    const badgeImpl = new EntityCheck();
    const config = {
      type: null,
    };
    const err = await waitError(badgeImpl.parseConfig(config));
    expect(err).toMatchInlineSnapshot(`
      [ZodError: [
        {
          "code": "invalid_type",
          "expected": "number",
          "received": "undefined",
          "path": [
            "entityId"
          ],
          "message": "Required"
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
    } satisfies z.infer<(typeof badgeImpl)["schema"]>;
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
    } satisfies z.infer<(typeof badgeImpl)["schema"]>;
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
    } satisfies z.infer<(typeof badgeImpl)["schema"]>;
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
    } satisfies z.infer<(typeof badgeImpl)["schema"]>;
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
    } satisfies z.infer<(typeof badgeImpl)["schema"]>;
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
    } satisfies z.infer<(typeof badgeImpl)["schema"]>;
    expect(badgeImpl.test(config, tasting)).toEqual(false);
  });
});
