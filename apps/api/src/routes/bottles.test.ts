import type { AppType } from "@peated/api/app";
import { app } from "@peated/api/app";
import { db } from "@peated/api/db";
import {
  bottles,
  bottlesToDistillers,
  changes,
  entities,
} from "@peated/api/db/schema";
import { createAccessToken } from "@peated/api/lib/auth";
import * as fixtures from "@peated/api/lib/test/fixtures";
import { and, eq } from "drizzle-orm";
import { testClient } from "hono/testing";
import { describe, expect, it } from "vitest";

describe("POST /bottles", () => {
  const client = testClient(app);

  it("creates a new bottle with minimal params", async () => {
    const user = await fixtures.User();
    const brand = await fixtures.Entity();
    const token = await createAccessToken(user);

    const res = await client.v1.bottles.$get({
      json: {
        name: "Delicious Wood",
        brand: brand.id,
      },
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    // const res = await app.request("/v1/bottles", {
    //   method: "POST",
    //   headers: {
    //     "Content-Type": "application/json",
    //     Authorization: `Bearer ${token}`,
    //   },
    //   body: JSON.stringify({
    //     name: "Delicious Wood",
    //     brand: brand.id,
    //   }),
    // });

    expect(res.status).toBe(200);
    const data = (await res.json()) as { bottle: any };
    expect(data.bottle).toBeDefined();
    expect(data.bottle.name).toBe("Delicious Wood");
    expect(data.bottle.brand.id).toBe(brand.id);

    // DB assertions
    const [bottleRow] = await db
      .select()
      .from(bottles)
      .where(eq(bottles.id, data.bottle.id));
    expect(bottleRow.name).toBe("Delicious Wood");
    expect(bottleRow.brandId).toBe(brand.id);
    expect(bottleRow.statedAge).toBeNull();
    const distillers = await db
      .select()
      .from(bottlesToDistillers)
      .where(eq(bottlesToDistillers.bottleId, bottleRow.id));
    expect(distillers.length).toBe(0);
  });

  it("creates a new bottle with all params", async () => {
    const user = await fixtures.User();
    const brand = await fixtures.Entity();
    const distiller = await fixtures.Entity();
    const token = await createAccessToken(user);

    const res = await app.request("/v1/bottles", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        name: "Delicious Wood 12-year-old",
        brand: brand.id,
        bottler: distiller.id,
        distillers: [distiller.id],
        statedAge: 12,
        flavorProfile: "fruity",
      }),
    });

    expect(res.status).toBe(200);
    const data = (await res.json()) as { bottle: any };
    expect(data.bottle).toBeDefined();
    expect(data.bottle.name).toBe("Delicious Wood 12-year-old");
    expect(data.bottle.brand.id).toBe(brand.id);
    expect(data.bottle.statedAge).toBe(12);
    expect(data.bottle.flavorProfile).toBe("fruity");
    expect(data.bottle.createdById).toBe(user.id);
    expect(data.bottle.distillers[0].id).toBe(distiller.id);

    // DB assertions
    const [bottleRow] = await db
      .select()
      .from(bottles)
      .where(eq(bottles.id, data.bottle.id));
    expect(bottleRow.name).toBe("Delicious Wood 12-year-old");
    expect(bottleRow.brandId).toBe(brand.id);
    expect(bottleRow.statedAge).toBe(12);
    expect(bottleRow.flavorProfile).toBe("fruity");
    expect(bottleRow.createdById).toBe(user.id);
    const distillers = await db
      .select({ distillerId: bottlesToDistillers.distillerId })
      .from(bottlesToDistillers)
      .where(eq(bottlesToDistillers.bottleId, bottleRow.id));
    expect(distillers.length).toBe(1);
    expect(distillers[0].distillerId).toBe(distiller.id);
    // Check changes
    const changeList = await db
      .select()
      .from(changes)
      .where(eq(changes.createdById, user.id));
    expect(changeList.length).toBeGreaterThan(0);
    expect(changeList.some((c) => c.objectId === bottleRow.id)).toBe(true);
  });

  it("does not create a new bottle with invalid brandId", async () => {
    const user = await fixtures.User();
    const token = await createAccessToken(user);
    const res = await app.request("/v1/bottles", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        name: "Delicious Wood",
        brand: 999999,
      }),
    });
    expect(res.status).toBe(409);
  });

  it("creates a new bottle with existing brand name", async () => {
    const user = await fixtures.User();
    const existingBrand = await fixtures.Entity();
    const token = await createAccessToken(user);
    const res = await app.request("/v1/bottles", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        name: "Delicious Wood",
        brand: { name: existingBrand.name },
      }),
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as { bottle: any };
    expect(data.bottle).toBeDefined();
    expect(data.bottle.brand.id).toBe(existingBrand.id);

    // DB assertions
    const [{ bottle: bottleRow, brand }] = await db
      .select({ bottle: bottles, brand: entities })
      .from(bottles)
      .innerJoin(entities, eq(entities.id, bottles.brandId))
      .where(eq(bottles.id, data.bottle.id));
    expect(bottleRow.name).toBe("Delicious Wood");
    expect(bottleRow.brandId).toBe(existingBrand.id);
    // Should not create a change entry for the brand
    const changeList = await db
      .select()
      .from(changes)
      .where(
        and(eq(changes.objectType, "entity"), eq(changes.createdById, user.id)),
      );
    expect(changeList.length).toBe(0);
  });

  it("creates a new bottle with new brand name", async () => {
    const user = await fixtures.User();
    const country = await fixtures.Country({ name: "United States" });
    const region = await fixtures.Region({
      countryId: country.id,
      name: "Kentucky",
    });
    const token = await createAccessToken(user);
    const res = await app.request("/v1/bottles", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        name: "Delicious Wood",
        brand: {
          id: null,
          name: "Hard Knox",
          country: country.id,
          region: region.id,
        },
      }),
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as { bottle: any };
    expect(data.bottle).toBeDefined();
    expect(data.bottle.brand.name).toBe("Hard Knox");
    expect(data.bottle.brand.country.id).toBe(country.id);
    expect(data.bottle.brand.region.id).toBe(region.id);

    // DB assertions
    const [{ bottle: bottleRow, brand }] = await db
      .select({ bottle: bottles, brand: entities })
      .from(bottles)
      .innerJoin(entities, eq(entities.id, bottles.brandId))
      .where(eq(bottles.id, data.bottle.id));
    expect(bottleRow.name).toBe("Delicious Wood");
    expect(bottleRow.brandId).toBeDefined();
    expect(brand.name).toBe("Hard Knox");
    expect(brand.createdById).toBe(user.id);
    expect(brand.countryId).toBe(country.id);
    expect(brand.regionId).toBe(region.id);
    // Should create a change entry for the brand
    const changeList = await db
      .select()
      .from(changes)
      .where(
        and(eq(changes.objectType, "entity"), eq(changes.createdById, user.id)),
      );
    expect(changeList.length).toBe(1);
  });

  it("does not create a new bottle with invalid distillerId", async () => {
    const user = await fixtures.User();
    const token = await createAccessToken(user);
    const res = await app.request("/v1/bottles", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        name: "Delicious Wood",
        brand: { name: "Hard Knox" },
        distillers: [500000],
      }),
    });
    expect(res.status).toBe(409);
    // No DB assertions needed for error
  });

  it("creates a new bottle with existing distiller name", async () => {
    const user = await fixtures.User();
    const existingBrand = await fixtures.Entity();
    const existingDistiller = await fixtures.Entity();
    const token = await createAccessToken(user);
    const res = await app.request("/v1/bottles", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        name: "Delicious Wood",
        brand: { name: existingBrand.name },
        distillers: [{ name: existingDistiller.name }],
      }),
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as { bottle: any };
    expect(data.bottle).toBeDefined();
    expect(data.bottle.name).toBe("Delicious Wood");
    expect(data.bottle.distillers[0].id).toBe(existingDistiller.id);

    // DB assertions
    const [bottleRow] = await db
      .select()
      .from(bottles)
      .where(eq(bottles.id, data.bottle.id));
    expect(bottleRow.name).toBe("Delicious Wood");
    const distillers = await db
      .select({ distiller: entities })
      .from(entities)
      .innerJoin(
        bottlesToDistillers,
        eq(bottlesToDistillers.distillerId, entities.id),
      )
      .where(eq(bottlesToDistillers.bottleId, bottleRow.id));
    expect(distillers.length).toBe(1);
    expect(distillers[0].distiller.id).toBe(existingDistiller.id);
    // Should not create a change entry for the brand
    const changeList = await db
      .select()
      .from(changes)
      .where(
        and(eq(changes.objectType, "entity"), eq(changes.createdById, user.id)),
      );
    expect(changeList.length).toBe(0);
  });

  it("creates a new bottle with new distiller name", async () => {
    const user = await fixtures.User();
    const brand = await fixtures.Entity();
    const token = await createAccessToken(user);
    const res = await app.request("/v1/bottles", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        name: "Delicious Wood",
        brand: brand.id,
        distillers: [{ name: "Hard Knox" }],
      }),
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as { bottle: any };
    expect(data.bottle).toBeDefined();
    expect(data.bottle.name).toBe("Delicious Wood");
    expect(data.bottle.distillers[0].name).toBe("Hard Knox");

    // DB assertions
    const [bottleRow] = await db
      .select()
      .from(bottles)
      .where(eq(bottles.id, data.bottle.id));
    expect(bottleRow.name).toBe("Delicious Wood");
    const distillers = await db
      .select({ distiller: entities })
      .from(entities)
      .innerJoin(
        bottlesToDistillers,
        eq(bottlesToDistillers.distillerId, entities.id),
      )
      .where(eq(bottlesToDistillers.bottleId, bottleRow.id));
    expect(distillers.length).toBe(1);
    expect(distillers[0].distiller.name).toBe("Hard Knox");
    expect(distillers[0].distiller.createdById).toBe(user.id);
    // Should create a change entry for the distiller
    const changeList = await db
      .select()
      .from(changes)
      .where(
        and(eq(changes.objectType, "entity"), eq(changes.createdById, user.id)),
      );
    expect(changeList.length).toBe(1);
  });

  it("creates a new bottle with new distiller and brand name", async () => {
    const user = await fixtures.User();
    const token = await createAccessToken(user);
    const res = await app.request("/v1/bottles", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        name: "Delicious Wood",
        brand: { name: "Rip Van" },
        distillers: [{ name: "Hard Knox" }],
      }),
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as { bottle: any };
    expect(data.bottle).toBeDefined();
    expect(data.bottle.name).toBe("Delicious Wood");
    expect(data.bottle.brand.name).toBe("Rip Van");
    expect(data.bottle.distillers[0].name).toBe("Hard Knox");

    // DB assertions
    const [bottleRow] = await db
      .select()
      .from(bottles)
      .where(eq(bottles.id, data.bottle.id));
    expect(bottleRow.name).toBe("Delicious Wood");
    const distillers = await db
      .select({ distiller: entities })
      .from(entities)
      .innerJoin(
        bottlesToDistillers,
        eq(bottlesToDistillers.distillerId, entities.id),
      )
      .where(eq(bottlesToDistillers.bottleId, bottleRow.id));
    expect(distillers.length).toBe(1);
    expect(distillers[0].distiller.name).toBe("Hard Knox");
    expect(distillers[0].distiller.createdById).toBe(user.id);
    const [brand] = await db
      .select()
      .from(entities)
      .where(eq(entities.id, bottleRow.brandId));
    expect(brand.name).toBe("Rip Van");
    // Should create a change entry for the brand and distiller
    const changeList = await db
      .select()
      .from(changes)
      .where(
        and(eq(changes.objectType, "entity"), eq(changes.createdById, user.id)),
      );
    expect(changeList.length).toBe(2);
  });

  it("creates a new bottle with new distiller name which is duplicated as brand name", async () => {
    const user = await fixtures.User();
    const token = await createAccessToken(user);
    const res = await app.request("/v1/bottles", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        name: "Delicious Wood",
        brand: { name: "Hard Knox" },
        distillers: [{ name: "Hard Knox" }],
      }),
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as { bottle: any };
    expect(data.bottle).toBeDefined();
    expect(data.bottle.name).toBe("Delicious Wood");
    expect(data.bottle.brand.name).toBe("Hard Knox");
    expect(data.bottle.distillers[0].name).toBe("Hard Knox");
    expect(data.bottle.distillers[0].id).toBe(data.bottle.brand.id);

    // DB assertions
    const [bottleRow] = await db
      .select()
      .from(bottles)
      .where(eq(bottles.id, data.bottle.id));
    expect(bottleRow.name).toBe("Delicious Wood");
    const distillers = await db
      .select({ distiller: entities })
      .from(entities)
      .innerJoin(
        bottlesToDistillers,
        eq(bottlesToDistillers.distillerId, entities.id),
      )
      .where(eq(bottlesToDistillers.bottleId, bottleRow.id));
    expect(distillers.length).toBe(1);
    expect(distillers[0].distiller.id).toBe(bottleRow.brandId);
    expect(distillers[0].distiller.name).toBe("Hard Knox");
    expect(distillers[0].distiller.createdById).toBe(user.id);
    // Should create a change entry for the brand and distiller (but only one if same entity)
    const changeList = await db
      .select()
      .from(changes)
      .where(
        and(eq(changes.objectType, "entity"), eq(changes.createdById, user.id)),
      );
    expect(changeList.length).toBe(1);
  });

  it("updates statedAge bottle w/ age signal", async () => {
    const user = await fixtures.User();
    const brand = await fixtures.Entity();
    const distiller = await fixtures.Entity();
    const token = await createAccessToken(user);
    const res = await app.request("/v1/bottles", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        name: "Delicious Wood 12-year-old",
        brand: brand.id,
        distillers: [distiller.id],
      }),
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as { bottle: any };
    expect(data.bottle.statedAge).toBe(12);

    // DB assertions
    const [bottleRow] = await db
      .select()
      .from(bottles)
      .where(eq(bottles.id, data.bottle.id));
    expect(bottleRow.statedAge).toBe(12);
  });

  it("removes duplicated brand name", async () => {
    const user = await fixtures.User();
    const brand = await fixtures.Entity({ name: "Delicious Wood" });
    const token = await createAccessToken(user);
    const res = await app.request("/v1/bottles", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        name: "Delicious Wood Yum Yum",
        brand: brand.id,
      }),
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as { bottle: any };
    expect(data.bottle.name).toBe("Yum Yum");
    expect(data.bottle.fullName).toBe("Delicious Wood Yum Yum");

    // DB assertions
    const [bottleRow] = await db
      .select()
      .from(bottles)
      .where(eq(bottles.id, data.bottle.id));
    expect(bottleRow.name).toBe("Yum Yum");
    expect(bottleRow.fullName).toBe("Delicious Wood Yum Yum");
  });

  it.skip("applies SMWS from bottle normalize", async () => {
    // This would require the normalization logic to be ported and tested
  });

  it("saves cask information", async () => {
    const user = await fixtures.User({ mod: true });
    const brand = await fixtures.Entity();
    const token = await createAccessToken(user);
    const res = await app.request("/v1/bottles", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        name: "Old Whisky",
        brand: brand.id,
        caskType: "sherry",
      }),
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as { bottle: any };
    expect(data.bottle.caskType).toBe("sherry");

    // DB assertions
    const [bottleRow] = await db
      .select()
      .from(bottles)
      .where(eq(bottles.id, data.bottle.id));
    expect(bottleRow.caskType).toBe("sherry");
  });
});
