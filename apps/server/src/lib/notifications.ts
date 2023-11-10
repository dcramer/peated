import { and, eq } from "drizzle-orm";
import type { AnyPgTable } from "drizzle-orm/pg-core";
import type { DatabaseType, TransactionType } from "../db";
import type { NewNotification, Notification } from "../db/schema";
import {
  bottles,
  comments,
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
  db: DatabaseType | TransactionType,
  notification: NewNotification,
) => {
  if (notification.userId === notification.fromUserId) {
    throw new Error(
      "You should not create notifications to and from the same user.",
    );
  }
  const [notif] = await db
    .insert(notifications)
    .values(notification)
    .onConflictDoNothing()
    .returning();
  return notif;
};

export const deleteNotification = async (
  db: DatabaseType | TransactionType,
  {
    type,
    objectId,
    userId,
  }: Pick<Notification, "type" | "objectId" | "userId">,
) => {
  await db
    .delete(notifications)
    .where(
      and(
        eq(notifications.type, type),
        eq(notifications.objectId, objectId),
        eq(notifications.userId, userId),
      ),
    );
};
