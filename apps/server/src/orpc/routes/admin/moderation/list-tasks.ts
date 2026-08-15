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
    const allTasks = await projectModerationTasks();
    const tasks = filterModerationTasks(allTasks, input);
    const offset = (input.cursor - 1) * input.limit;
    const page = tasks.slice(offset, offset + input.limit);
    return {
      results: page,
      counts: {
        all: allTasks.length,
        listing: allTasks.filter(({ category }) => category === "listing")
          .length,
        catalog: allTasks.filter(({ category }) => category === "catalog")
          .length,
        blocked: allTasks.filter(({ state }) => state === "blocked").length,
        inconclusive: allTasks.filter(({ inconclusive }) => inconclusive)
          .length,
      },
      rel: {
        nextCursor:
          offset + input.limit < tasks.length ? input.cursor + 1 : null,
        prevCursor: input.cursor > 1 ? input.cursor - 1 : null,
      },
    };
  });
