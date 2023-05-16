import { and, eq } from "drizzle-orm";
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import { AnyPgTable } from "drizzle-orm/pg-core";
import {
  NewNotification,
  Notification,
  bottles,
  comments,
  editions,
  entities,
  follows,
  notifications,
  tastings,
  toasts,
} from "../db/schema";

export const objectTypeFromSchema = (schema: AnyPgTable) => {
  switch (schema) {
    case bottles:
      return "bottle";
    case comments:
      return "comment";
    case editions:
      return "edition";
    case entities:
      return "entity";
    case follows:
      return "follow";
    case toasts:
      return "toast";
    case tastings:
      return "tasting";
    default:
      throw new Error("Invalid schema");
  }
};

export const createNotification = async (
  db: NodePgDatabase,
  notification: NewNotification,
) => {
  await db.insert(notifications).values(notification).onConflictDoNothing();
};

export const deleteNotification = async (
  db: NodePgDatabase,
  {
    objectType,
    objectId,
    userId,
  }: Pick<Notification, "objectType" | "objectId" | "userId">,
) => {
  await db
    .delete(notifications)
    .where(
      and(
        eq(notifications.objectType, objectType),
        eq(notifications.objectId, objectId),
        eq(notifications.userId, userId),
      ),
    );
};
