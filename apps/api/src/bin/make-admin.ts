import { db } from "../lib/db";
import { createInterface } from "readline/promises";
import { users } from "../db/schema";
import { eq } from "drizzle-orm";

const readline = createInterface({
  input: process.stdin,
  output: process.stdout,
});

const main = async () => {
  const email = await readline.question("Email? ");
  readline.close();

  const [user] = await db.select().from(users).where(eq(users.email, email));
  await db.update(users).set({ admin: true }).where(eq(users.id, user.id));

  console.log(`${user.email} updated to be admin.`);
};

main();
