import { program } from "commander";
import { and, eq, ne, sql } from "drizzle-orm";

import { db } from "../db";
import type { Bottle, Entity, ExternalSite } from "../db/schema";
import { bottles, externalSites, tastings, users } from "../db/schema";
import { createNotification } from "../lib/notifications";
import { random } from "../lib/rand";
import * as Fixtures from "../lib/test/fixtures";

const loadDefaultSites = async () => {
  const store1 =
    (await db.query.externalSites.findFirst({
      where: eq(externalSites.type, "totalwines"),
    })) ||
    (await Fixtures.ExternalSite({
      name: "Total Wine",
      type: "totalwines",
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
  const mocks: Pick<Entity, "name" | "country" | "region" | "type">[] = [
    {
      name: "The Macallan",
      country: "Scotland",
      region: "Speyside",
      type: ["brand", "distiller", "bottler"],
    },
    {
      name: "The Balvenie",
      country: "Scotland",
      region: "Speyside",
      type: ["brand", "distiller", "bottler"],
    },
    {
      name: "Jack Daniel's",
      country: "United States of America",
      region: "Tennessee",
      type: ["brand", "distiller", "bottler"],
    },
    {
      name: "Maker's Mark",
      country: "United States of America",
      region: "Kentucky",
      type: ["brand"],
    },
  ];

  const results: Entity[] = [];

  for (const data of mocks) {
    results.push(
      (await db.query.entities.findFirst({
        where: (entities, { eq }) => eq(entities.name, data.name),
      })) || (await Fixtures.Entity(data)),
    );
  }

  return results;
};

const loadDefaultBottles = async (
  brandList: Entity[],
  siteList: ExternalSite[],
) => {
  const mocks: Pick<Bottle, "name" | "statedAge" | "brandId">[] = [];

  brandList.forEach((brand) => {
    mocks.push(
      {
        name: "12-year-old",
        statedAge: 12,
        brandId: brand.id,
      },
      {
        name: "18-year-old",
        statedAge: 18,
        brandId: brand.id,
      },
      {
        name: "25-year-old",
        statedAge: 25,
        brandId: brand.id,
      },
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

program.name("mocks").description("CLI for assisting with Drizzle");

program
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
    const brandList = await loadDefaultEntities();
    const siteList = await loadDefaultSites();
    const bottleList = await loadDefaultBottles(brandList, siteList);

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

program.parseAsync();
