import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db } from "../lib/db";

// this will automatically run needed migrations on the database
migrate(db, { migrationsFolder: "./migrations" })
  .then(() => {
    console.log("Migrations complete!");
    process.exit(0);
  })
  .catch((err) => {
    console.error("Migrations failed!", err);
    process.exit(1);
  });
