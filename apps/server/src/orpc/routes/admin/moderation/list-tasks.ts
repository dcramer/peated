import {
  filterModerationTasks,
  projectModerationTasks,
} from "@peated/server/lib/moderationTasks";
import { procedure } from "@peated/server/orpc";
import { requireAdmin } from "@peated/server/orpc/middleware";
import {
  ModerationTaskListInputSchema,
  ModerationTaskListResponseSchema,
} from "./schemas";

export default procedure
  .use(requireAdmin)
  .route({
    method: "GET",
    path: "/admin/moderation/tasks",
    summary: "List moderation tasks",
    description:
      "Project outstanding human moderation decisions across their owning sources. Requires administrator privileges.",
    operationId: "listModerationTasks",
  })
  .input(ModerationTaskListInputSchema)
  .output(ModerationTaskListResponseSchema)
  .handler(async ({ input }) => {
    const tasks = filterModerationTasks(await projectModerationTasks(), input);
    const offset = (input.cursor - 1) * input.limit;
    const page = tasks.slice(offset, offset + input.limit);
    return {
      results: page,
      counts: {
        all: tasks.length,
        listing: tasks.filter(({ category }) => category === "listing").length,
        catalog: tasks.filter(({ category }) => category === "catalog").length,
        blocked: tasks.filter(({ state }) => state === "blocked").length,
      },
      rel: {
        nextCursor:
          offset + input.limit < tasks.length ? input.cursor + 1 : null,
        prevCursor: input.cursor > 1 ? input.cursor - 1 : null,
      },
    };
  });
