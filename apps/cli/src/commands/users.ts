import program from "@peated/cli/program";
import { db } from "@peated/server/db";
import { users } from "@peated/server/db/schema";
import {
  createAccessToken,
  createUser,
  generatePasswordHash,
} from "@peated/server/lib/auth";
import { eq } from "drizzle-orm";

const subcommand = program.command("users");

subcommand
  .command("create")
  .description("Create a user")
  .argument("<email>")
  .argument("<password>")
  .option("-a, --admin")
  .option("-v, --verified")
  .action(async (email, password, options) => {
    const user = await createUser(db, {
      email,
      username: email.split("@")[0],
      passwordHash: generatePasswordHash(password),
      admin: options.admin || false,
      mod: options.admin || false,
      verified: options.verified || false,
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
    if (!user) {
      throw new Error(`Unknown user: ${email}.`);
    }

    await db
      .update(users)
      .set({ passwordHash: generatePasswordHash(password) })
      .where(eq(users.id, user.id));

    console.log(`${user.email} password changed`);
  });

subcommand
  .command("make-admin")
  .description("Make a user admin")
  .argument("<email>")
  .action(async (email) => {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    if (!user) {
      throw new Error(`Unknown user: ${email}.`);
    }

    await db
      .update(users)
      .set({ mod: true, admin: true })
      .where(eq(users.id, user.id));

    console.log(`${user.email} updated to be admin.`);
  });

subcommand
  .command("set-verified")
  .description("Set the verified flag on a user")
  .argument("<email>")
  .action(async (email) => {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    if (!user) {
      throw new Error(`Unknown user: ${email}.`);
    }

    await db.update(users).set({ verified: true }).where(eq(users.id, user.id));

    console.log(`${user.email} updated to be admin.`);
  });

subcommand
  .command("generate-token")
  .description("Generate a bearer token")
  .argument("<email>")
  .action(async (email) => {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    if (!user) {
      throw new Error(`Unknown user: ${email}.`);
    }

    const token = await createAccessToken(user);

    console.log(`ACCESS_TOKEN=${token}`);
  });
