import { hashSync } from "bcrypt";
import { createInterface } from "readline/promises";
import { db } from "../db";
import { users } from "../db/schema";

const readline = createInterface({
  input: process.stdin,
  output: process.stdout,
});

const main = async () => {
  const email = await readline.question("Email? ");
  // TODO: this should be a hidden input, but Node seems to still be decades behind
  const password = await readline.question("Password? ");
  const displayName = await readline.question("Name? ");
  const admin =
    (await readline.question("Admin [Y/n]? ")).toLowerCase() !== "n";
  readline.close();

  const [user] = await db
    .insert(users)
    .values({
      displayName,
      email,
      passwordHash: hashSync(password, 8),
      admin,
    })
    .returning();

  console.log(`${user.email} created.`);
};

main();
