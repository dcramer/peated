import { eq, ne } from "drizzle-orm";
import { db } from "../db";
import { users } from "../db/schema";
import * as Fixtures from "../lib/test/fixtures";

const main = async (yourUserEmail?: string) => {
  let bottle;
  for (let i = 0; i < 100; i++) {
    bottle = await Fixtures.Bottle();
    console.log(`${bottle.name} created.`);
  }

  if (yourUserEmail) {
    const [{ id: toUserId }] = await db
      .select()
      .from(users)
      .where(eq(users.email, yourUserEmail));
    const userList = await db
      .select()
      .from(users)
      .where(ne(users.id, toUserId))
      .limit(5);

    for (const { id: fromUserId } of userList) {
      await Fixtures.Follow({
        toUserId,
        fromUserId,
        status: "pending",
      });
      console.log(`Created follow request from ${fromUserId} -> ${toUserId}`);
    }
  }
};

main(process.argv[2]);
