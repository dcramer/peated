import { eq, ne, sql } from "drizzle-orm";
import { db } from "../db";
import { bottles, follows, tastings, toasts, users } from "../db/schema";
import * as Fixtures from "../lib/test/fixtures";

import { program } from "commander";
import { createNotification, objectTypeFromSchema } from "../lib/notifications";

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
    for (let i = 0; i < options.bottles; i++) {
      const bottle = await Fixtures.Bottle();
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
          objectId: follow.fromUserId,
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
