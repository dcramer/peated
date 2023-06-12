import { program } from "commander";
import { eq, ne, sql } from "drizzle-orm";

import { db } from "../db";
import type {
  Entity} from "../db/schema";
import {
  bottles,
  follows,
  tastings,
  toasts,
  users,
} from "../db/schema";
import { createNotification, objectTypeFromSchema } from "../lib/notifications";
import { choose } from "../lib/rand";
import * as Fixtures from "../lib/test/fixtures";

const loadDefaultEntities = async () => {
  const mocks = [
    {
      name: "The Macallan",
      country: "Scotland",
      region: "Speyside",
      type: "brand",
    },
    {
      name: "The Balvenie",
      country: "Scotland",
      region: "Speyside",
      type: "brand",
    },
    {
      name: "Jack Daniel's",
      country: "United States of America",
      region: "Tennessee",
      type: "brand",
    },
    {
      name: "Maker's Mark",
      country: "United States of America",
      region: "Kentucky",
      type: "brand",
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

program.name("mocks").description("CLI for assisting with Drizzle");

program
  .command("load-all")
  .argument("[email]", "define a user to receive new follows")
  .option(
    "--bottles <number>",
    "number of bottles",
    (v: string) => parseInt(v, 10),
    5,
  )
  .option(
    "--tastings <number>",
    "number of tastings",
    (v: string) => parseInt(v, 10),
    5,
  )
  .action(async (email, options) => {
    // load some realistic entities

    const brands = await loadDefaultEntities();

    for (let i = 0; i < options.bottles; i++) {
      const bottle = await Fixtures.Bottle({
        brandId: choose(brands).id,
      });
      console.log(`bottle ${bottle.name} created.`);
    }

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
          objectType: objectTypeFromSchema(follows),
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
          objectType: objectTypeFromSchema(toasts),
          objectId: toast.id,
          userId: toUserId,
          createdAt: toast.createdAt,
        });
        console.log(`Created toast from ${fromUserId}`);
      }
    }
  });

program.parseAsync();
