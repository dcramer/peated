import type { Entity, NewBottle } from "@peated/server/db/schema";
import type * as Fixtures from "@peated/server/lib/test/fixtures";

export async function createTastingForBadge(
  fixtures: typeof Fixtures,
  {
    brand,
    distillers = [],
    ...bottleData
  }: Omit<Partial<NewBottle>, "id" | "brandId"> & {
    distillers?: Entity[];
    brand?: Entity;
  } = {},
) {
  if (!brand) brand = await fixtures.Entity({ type: ["brand"] });
  const bottle = await fixtures.Bottle({
    name: "A",
    ...bottleData,
    brandId: brand.id,
    distillerIds: distillers.map((d) => d.id),
  });
  const tasting = await fixtures.Tasting({
    bottleId: bottle.id,
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
