import type { Entity, NewBottle } from "@peated/server/db/schema";
import type * as Fixtures from "@peated/server/lib/test/fixtures";

export async function createTastingForBadge(
  fixtures: typeof Fixtures,
  {
    brand,
    bottler,
    distillers = [],
    ...bottleData
  }: Omit<Partial<NewBottle>, "id" | "brandId"> & {
    distillers?: Entity[];
    bottler?: Entity | null;
    brand?: Entity;
  } = {},
  userId: number | null = null,
) {
  if (!brand) brand = await fixtures.Entity({ type: ["brand"] });
  const bottle = await fixtures.Bottle({
    name: "A",
    ...bottleData,
    brandId: brand.id,
    bottlerId: bottler ? bottler.id : null,
    distillerIds: distillers.map((d) => d.id),
  });
  const tasting = await fixtures.Tasting({
    bottleId: bottle.id,
    createdById: userId ?? undefined,
  });
  return {
    ...tasting,
    bottle: {
      ...bottle,
      brand,
      bottler: null,
      bottlesToDistillers: distillers.length
        ? distillers.map((d) => ({
            bottleId: bottle.id,
            distillerId: d.id,
            distiller: d,
          }))
        : [],
    },
  };
}
