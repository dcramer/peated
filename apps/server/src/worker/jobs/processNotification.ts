import { db } from "@peated/server/db";
import { notifyComment } from "@peated/server/lib/email";

export default async function processNotification({
  notificationId,
}: {
  notificationId: number;
}) {
  const notif = await db.query.notifications.findFirst({
    where: (notifications, { eq }) => eq(notifications.id, notificationId),
  });
  if (!notif) {
    throw new Error(`Unknown notifification: ${notificationId}`);
  }

  if (notif.type === "comment") {
    const comment = await db.query.comments.findFirst({
      where: (comments, { eq }) => eq(comments.id, notif.objectId),
      with: {
        createdBy: true,
        tasting: {
          with: {
            bottle: true,
            createdBy: true,
          },
        },
      },
    });

    if (!comment) {
      throw new Error(
        `Unable to find comment for notification: ${notificationId}`
      );
    }

    await notifyComment({
      comment,
    });
  }
}
