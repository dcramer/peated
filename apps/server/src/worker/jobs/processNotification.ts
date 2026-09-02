import { db } from "@peated/server/db";
import { notifyComment } from "@peated/server/lib/email";
import type { JobPayload } from "@peated/server/worker/types";
import { z } from "zod";

export const ProcessNotificationJobArgsSchema = z
  .object({
    notificationId: z.number().int().positive(),
  })
  .strict();

export default async function processNotification(input: JobPayload) {
  const { notificationId } = ProcessNotificationJobArgsSchema.parse(input);

  const notif = await db.query.notifications.findFirst({
    where: (notifications, { eq }) => eq(notifications.id, notificationId),
  });
  if (!notif) return;

  if (notif.type === "comment") {
    const comment = await db.query.comments.findFirst({
      where: (comments, { eq }) => eq(comments.id, notif.objectId),
      with: {
        createdBy: true,
        tasting: {
          with: {
            createdBy: true,
          },
        },
      },
    });

    if (!comment) return;

    await notifyComment({
      comment,
    });
  }
}
