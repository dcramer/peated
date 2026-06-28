import program from "@peated/cli/program";
import { db } from "@peated/server/db";
import { users } from "@peated/server/db/schema";
import {
  createAccessToken,
  createUser,
  generatePasswordHash,
} from "@peated/server/lib/auth";
import { eq, sql } from "drizzle-orm";

const subcommand = program.command("users");

subcommand
  .command("create")
  .description("Create a user")
  .argument("<email>")
  .argument("<password>")
  .option("-a, --admin")
  .option("-v, --verified")
  .option("--accept-terms")
  .option("--if-exists", "Update and reuse an existing user with this email")
  .action(async (email, password, options) => {
    let user;
    try {
      user = await createUser(db, {
        email,
        username: email.split("@")[0],
        passwordHash: generatePasswordHash(password),
        admin: options.admin || false,
        mod: options.admin || false,
        verified: options.verified || false,
        termsAcceptedAt: options.acceptTerms ? new Date() : null,
      });
    } catch (err: any) {
      if (
        !options.ifExists ||
        err?.code !== "23505" ||
        !["user_email_unq", "user_username_unq"].includes(err?.constraint)
      ) {
        throw err;
      }

      const updatedFields: Partial<typeof users.$inferInsert> = {
        passwordHash: generatePasswordHash(password),
      };
      if (options.admin) {
        updatedFields.admin = true;
        updatedFields.mod = true;
      }
      if (options.verified) {
        updatedFields.verified = true;
      }
      if (options.acceptTerms) {
        updatedFields.termsAcceptedAt = new Date();
      }

      const [existingUser] = await db
        .update(users)
        .set(updatedFields)
        .where(eq(sql`LOWER(${users.email})`, email.toLowerCase()))
        .returning();
      if (!existingUser) {
        throw new Error(`Unknown user: ${email}.`);
      }
      user = existingUser;
    }

    console.log(`${user.email} ready.`);
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
