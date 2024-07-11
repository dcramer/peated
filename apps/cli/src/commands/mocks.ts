import program from "@peated/cli/program";
import { db } from "@peated/server/db";
import type {
  Bottle,
  Entity,
  EntityType,
  ExternalSite,
} from "@peated/server/db/schema";
import {
  bottles,
  externalSites,
  tastings,
  users,
} from "@peated/server/db/schema";
import { createNotification } from "@peated/server/lib/notifications";
import { random, sample } from "@peated/server/lib/rand";
import { SMWS_DISTILLERY_CODES } from "@peated/server/lib/smws";
import * as Fixtures from "@peated/server/lib/test/fixtures";
import { type Category } from "@peated/server/types";
import { and, eq, ne, sql } from "drizzle-orm";
import { MAJOR_COUNTRIES } from "../../../server/src/constants";

const loadDefaultSites = async () => {
  const store1 =
    (await db.query.externalSites.findFirst({
      where: eq(externalSites.type, "totalwine"),
    })) ||
    (await Fixtures.ExternalSite({
      name: "Total Wine",
      type: "totalwine",
    }));
  const store2 =
    (await db.query.externalSites.findFirst({
      where: eq(externalSites.type, "woodencork"),
    })) ||
    (await Fixtures.ExternalSite({
      name: "Wooden Cork",
      type: "woodencork",
    }));

  return [store1, store2];
};

const loadDefaultEntities = async () => {
  const distilleryList = [];
  for (
    let i = 1, distilleryName;
    (distilleryName = SMWS_DISTILLERY_CODES[i]);
    i++
  ) {
    distilleryList.push(distilleryName);
  }

  // TODO: add countries
  const mocks: Pick<Entity, "name" | "type" | "shortName">[] = [
    {
      name: "The Scotch Malt Whisky Society",
      type: ["brand", "bottler"],
      shortName: "SMWS",
    },
    ...distilleryList.map((name) => ({
      name,
      type: ["brand", "distiller"] as EntityType[],
      shortName: null,
    })),
  ];

  const majorCountries = await db.query.countries.findMany({
    where: (countries, { inArray }) =>
      inArray(
        countries.name,
        MAJOR_COUNTRIES.map(([name]) => name),
      ),
  });

  const results: Entity[] = [];

  for (const data of mocks) {
    results.push(
      (await db.query.entities.findFirst({
        where: (entities, { eq }) => eq(entities.name, data.name),
      })) ||
        (await Fixtures.Entity({
          ...data,
          countryId: sample(majorCountries, 1)[0].id,
        })),
    );
  }

  return results;
};

const BOTTLE_META: {
  name: string;
  category?: Category;
  statedAge?: number;
}[] = [
  {
    name: "10-year-old",
    category: "single_malt",
    statedAge: 10,
  },
  {
    name: "12-year-old",
    category: "single_malt",
    statedAge: 12,
  },
  {
    name: "15-year-old",
    category: "single_malt",
    statedAge: 15,
  },
  {
    name: "18-year-old",
    category: "single_malt",
    statedAge: 18,
  },
  {
    name: "Double Rye",
    category: "rye",
  },
  {
    name: "Double Bourbon",
    category: "bourbon",
  },
  {
    name: "Bourbon",
    category: "bourbon",
  },
  {
    name: "Single Malt",
    category: "single_malt",
  },
  {
    name: "American Bourbon",
    category: "bourbon",
  },
  {
    name: "American Rye",
    category: "rye",
  },
  {
    name: "Barrel Strength",
    category: "single_malt",
  },
];

const loadDefaultBottles = async (
  entityList: Entity[],
  siteList: ExternalSite[],
) => {
  const mocks: (Pick<Bottle, "name" | "brandId" | "category" | "statedAge"> & {
    distillerIds?: number[];
  })[] = [];

  const distilleryIdList = entityList
    .filter((e) => e.type.includes("distiller"))
    .map((e) => e.id);

  sample(
    entityList.filter((e) => e.type.includes("brand")),
    5,
  ).forEach((brand) => {
    mocks.push(
      ...sample(BOTTLE_META, random(1, 8)).map((data) => ({
        category: null,
        statedAge: null,
        ...data,
        brandId: brand.id,
        distillerIds: brand.type.includes("distiller")
          ? [brand.id]
          : sample(distilleryIdList, random(0, 2)),
      })),
    );
  });

  const dates: Date[] = [];
  const tDate = new Date();
  for (let i = 0; i < 30; i++) {
    tDate.setDate(tDate.getDate() - 1);
    dates.push(new Date(tDate.getTime()));
  }

  const results: Bottle[] = [];

  let bottle: Bottle;
  for (const data of mocks) {
    bottle =
      (await db.query.bottles.findFirst({
        where: (bottles, { eq, and }) =>
          and(eq(bottles.name, data.name), eq(bottles.brandId, data.brandId)),
      })) || (await Fixtures.Bottle(data));
    results.push(bottle);

    for (const site of siteList) {
      const price =
        (await db.query.storePrices.findFirst({
          where: (storePrices, { eq, and }) =>
            and(
              eq(storePrices.externalSiteId, site.id),
              eq(storePrices.bottleId, bottle.id),
            ),
        })) ||
        (await Fixtures.StorePrice({
          externalSiteId: site.id,
          bottleId: bottle.id,
        }));

      await Fixtures.Review({
        externalSiteId: site.id,
        bottleId: bottle.id,
      });

      await Fixtures.Review({
        externalSiteId: site.id,
        bottleId: null,
      });

      await Fixtures.StorePrice({
        externalSiteId: site.id,
        bottleId: null,
      });
      await Fixtures.StorePrice({
        externalSiteId: site.id,
        bottleId: null,
      });
      await Fixtures.StorePrice({
        externalSiteId: site.id,
        bottleId: null,
      });

      for (let i = 0; i < dates.length; i++) {
        (await db.query.storePriceHistories.findFirst({
          where: (storePriceHistories, { eq }) =>
            and(
              eq(storePriceHistories.priceId, price.id),
              eq(storePriceHistories.date, dates[i].toDateString()),
            ),
        })) ||
          (await Fixtures.StorePriceHistory({
            priceId: price.id,
            price:
              price.price +
              (random(0, 1) === 0 ? -1 : 1 * random(100, price.price / 2)),
            volume: price.volume,
            date: dates[i].toDateString(),
          }));
      }
    }
    console.log(`Bottle ${bottle.fullName} created.`);
  }
};

const subcommand = program.command("mocks");

subcommand
  .command("load-all")
  .argument("[email]", "define a user to receive new follows")
  .option(
    "--tastings <number>",
    "number of tastings",
    (v: string) => Number(v),
    5,
  )
  .action(async (email, options) => {
    // load some realistic entities
    const entityList = await loadDefaultEntities();
    const siteList = await loadDefaultSites();
    const bottleList = await loadDefaultBottles(entityList, siteList);

    for (let i = 0; i < options.tastings; i++) {
      const tasting = await Fixtures.Tasting({
        bottleId: (
          await db
            .select()
            .from(bottles)
            .orderBy(sql`RANDOM()`)
            .limit(1)
        )[0].id,
      });
      console.log(`tasting ${tasting.id} created.`);
    }

    if (email) {
      const [{ id: toUserId }] = await db
        .select()
        .from(users)
        .where(eq(users.email, email));
      const userList = await db
        .select()
        .from(users)
        .where(ne(users.id, toUserId))
        .orderBy(sql`RANDOM()`)
        .limit(5);

      for (const { id: fromUserId } of userList) {
        const follow = await Fixtures.Follow({
          toUserId,
          fromUserId,
          status: "pending",
        });
        await createNotification(db, {
          fromUserId: follow.fromUserId,
          type: "friend_request",
          objectId: follow.id,
          userId: follow.toUserId,
          createdAt: follow.createdAt,
        });
        console.log(`Created follow request from ${fromUserId} -> ${toUserId}`);
      }

      const [lastTasting] = await db
        .insert(tastings)
        .values({
          bottleId: (
            await db
              .select()
              .from(bottles)
              .orderBy(sql`RANDOM()`)
              .limit(1)
          )[0].id,
          rating: 4.5,
          createdById: toUserId,
        })
        .returning();
      for (const { id: fromUserId } of userList) {
        const toast = await Fixtures.Toast({
          tastingId: lastTasting.id,
          createdById: fromUserId,
        });
        await createNotification(db, {
          fromUserId: fromUserId,
          type: "toast",
          objectId: toast.id,
          userId: toUserId,
          createdAt: toast.createdAt,
        });
        console.log(`Created toast from ${fromUserId}`);
      }
    }
  });
