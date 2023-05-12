import { hashSync } from "bcrypt";
import { program } from "commander";
import { db } from "../db";
import { users } from "../db/schema";
import { createAccessToken } from "../lib/auth";
import { eq } from "drizzle-orm";

program.name("user").description("CLI for assisting with user management");

program
  .command("create")
  .description("Create a user")
  .argument("<email>")
  .argument("<password>")
  .option("--admin")
  .option("-d", "--display-name <displayName>")
  .action(async (email, password, options) => {
    const [user] = await db
      .insert(users)
      .values({
        displayName: options.displayName || email.split("@")[0],
        email,
        passwordHash: hashSync(password, 8),
        admin: options.admin || false,
      })
      .returning();

    console.log(`${user.email} created.`);
  });

program
  .command("make-admin")
  .description("Make a user admin")
  .argument("<email>")
  .action(async (email) => {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    await db.update(users).set({ admin: true }).where(eq(users.id, user.id));

    console.log(`${user.email} updated to be admin.`);
  });

program
  .command("generate-token")
  .description("Generate a bearer token")
  .argument("<email>")
  .action(async (email) => {
    const [user] = await db.select().from(users).where(eq(users.email, email));

    const token = await createAccessToken(user);

    console.log(`ACCESS_TOKEN=${token}`);
  });

program.parseAsync();
