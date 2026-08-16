import { locateModerationTask } from "@peated/server/lib/moderationTasks";
import { procedure } from "@peated/server/orpc";
import { requireAdmin } from "@peated/server/orpc/middleware";
import {
  ModerationTaskLocatorInputSchema,
  ModerationTaskLocatorResponseSchema,
} from "./schemas";

export default procedure
  .use(requireAdmin)
  .route({
    method: "GET",
    path: "/admin/moderation/tasks/{key}",
    summary: "Locate a moderation task",
    description:
      "Revalidate an actionable moderation task and return its owning source identifiers. Requires administrator privileges.",
    operationId: "getModerationTask",
  })
  .input(ModerationTaskLocatorInputSchema)
  .output(ModerationTaskLocatorResponseSchema)
  .handler(async ({ input, errors }) => {
    const task = await locateModerationTask(input.key);
    if (!task) {
      throw errors.NOT_FOUND({
        message: "This moderation task no longer needs attention.",
      });
    }
    return { task };
  });
