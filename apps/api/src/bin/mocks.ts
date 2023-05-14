import { eq, ne, sql } from "drizzle-orm";
import { db } from "../db";
import { bottles, follows, users } from "../db/schema";
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
    25,
  )
  .option(
    "--tastings <number>",
    "number of tastings",
    (v: string) => parseInt(v, 10),
    25,
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
    }
  });

program.parseAsync();
