import {
  filterModerationTasks,
  projectModerationTasks,
} from "@peated/server/lib/moderationTasks";
import { procedure } from "@peated/server/orpc";
import { requireMod } from "@peated/server/orpc/middleware";
import {
  ModerationTaskListInputSchema,
  ModerationTaskListResponseSchema,
} from "./schemas";

export default procedure
  .use(requireMod)
  .route({
    method: "GET",
    path: "/admin/moderation/tasks",
    summary: "List moderation tasks",
    description:
      "List pending moderation decisions for incoming store listings, auction lots, and imported reviews, catalog changes, and member reports. Ignored sources are not listed here; see `GET /admin/moderation/ignored`. Requires a moderator or administrator.",
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
        incoming: allTasks.filter(({ category }) => category === "incoming")
          .length,
        catalog: allTasks.filter(({ category }) => category === "catalog")
          .length,
        community: allTasks.filter(({ category }) => category === "community")
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
