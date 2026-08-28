import {
  filterModerationHistory,
  projectModerationHistory,
} from "@peated/server/lib/moderationHistory";
import { procedure } from "@peated/server/orpc";
import { requireAdmin } from "@peated/server/orpc/middleware";
import {
  ModerationHistoryListInputSchema,
  ModerationHistoryListResponseSchema,
} from "./schemas";

export default procedure
  .use(requireAdmin)
  .route({
    method: "GET",
    path: "/admin/moderation/history",
    summary: "List moderation history",
    description:
      "Project durable listing decisions, operation externalReviews, and audit closures. Requires administrator privileges.",
    operationId: "listModerationHistory",
  })
  .input(ModerationHistoryListInputSchema)
  .output(ModerationHistoryListResponseSchema)
  .handler(async ({ input }) => {
    const events = filterModerationHistory(
      await projectModerationHistory(),
      input,
    );
    const offset = (input.cursor - 1) * input.limit;
    return {
      results: events.slice(offset, offset + input.limit),
      rel: {
        nextCursor:
          offset + input.limit < events.length ? input.cursor + 1 : null,
        prevCursor: input.cursor > 1 ? input.cursor - 1 : null,
      },
    };
  });
