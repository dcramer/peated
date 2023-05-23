import { and, eq } from "drizzle-orm";
import { AnyPgTable } from "drizzle-orm/pg-core";
import { DatabaseType, TransactionType } from "../db";
import { Activity, NewActivity, activities, tastings } from "../db/schema";

export const objectTypeForActivity = (schema: AnyPgTable): "tasting" => {
  switch (schema) {
    case tastings:
      return "tasting";
    default:
      throw new Error("Invalid schema");
  }
};

export const getPayload = (schema: AnyPgTable, data: Record<string, any>) => {
  const basePayload = {
    objectType: objectTypeForActivity(schema),
    objectId: data.id,
    createdById: data.createdById,
    createdAt: data.createdAt,
  };
  switch (schema) {
    case tastings:
      return {
        ...basePayload,
        data: {
          bottleName: "",
        },
      };
  }
};

export const createActivity = async (
  db: DatabaseType | TransactionType,
  activity: NewActivity,
) => {
  const [result] = await db
    .insert(activities)
    .values(activity)
    .onConflictDoNothing()
    .returning();
  return result;
};

export const deleteActivity = async (
  db: DatabaseType | TransactionType,
  { objectType, objectId }: Pick<Activity, "objectType" | "objectId">,
) => {
  await db
    .delete(activities)
    .where(
      and(
        eq(activities.objectType, objectType),
        eq(activities.objectId, objectId),
      ),
    );
};
