import { eq } from "drizzle-orm";
import { users } from "../db/schema";
import { createAccessToken } from "../lib/auth";
import { db } from "../lib/db";

const main = async (email: string) => {
  if (!email) {
    throw new Error("No email specified");
  }
  const [user] = await db.select().from(users).where(eq(users.email, email));

  const token = await createAccessToken(user);

  console.log(`ACCESS_TOKEN=${token}`);
};

main(process.argv[2]);
