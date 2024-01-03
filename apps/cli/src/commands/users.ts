import program from "@peated/cli/program";
import { db } from "@peated/server/db";
import { users } from "@peated/server/db/schema";
import { createAccessToken, createUser } from "@peated/server/lib/auth";
import { hashSync } from "bcrypt";
import { eq } from "drizzle-orm";

const subcommand = program.command("users");

subcommand
  .command("create")
  .description("Create a user")
  .argument("<email>")
  .argument("<password>")
  .option("-a, --admin")
  .option("--display-name <displayName>")
  .action(async (email, password, options) => {
    const user = await createUser(db, {
      displayName: options.displayName || email.split("@")[0],
      email,
      username: email.split("@")[0],
      passwordHash: hashSync(password, 8),
      admin: options.admin || false,
    });

    console.log(`${user.email} created.`);
  });

subcommand
  .command("set-password")
  .description("Set a users password")
  .argument("<email>")
  .argument("<password>")
  .action(async (email, password) => {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    await db
      .update(users)
      .set({ passwordHash: hashSync(password, 8) })
      .where(eq(users.id, user.id));

    console.log(`${user.email} password changed`);
  });

subcommand
  .command("make-admin")
  .description("Make a user admin")
  .argument("<email>")
  .action(async (email) => {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    await db.update(users).set({ admin: true }).where(eq(users.id, user.id));

    console.log(`${user.email} updated to be admin.`);
  });

subcommand
  .command("generate-token")
  .description("Generate a bearer token")
  .argument("<email>")
  .action(async (email) => {
    const [user] = await db.select().from(users).where(eq(users.email, email));

    const token = await createAccessToken(user);

    console.log(`ACCESS_TOKEN=${token}`);
  });
