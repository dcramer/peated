import { expect, test } from "vitest";
import processNotification from "./processNotification";

test("skips stale work for a deleted Notification", async () => {
  await expect(
    processNotification({ notificationId: 2_147_483_647 }),
  ).resolves.toBeUndefined();
});
