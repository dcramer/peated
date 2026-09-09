import { queryModerationHistory } from "@peated/server/lib/moderationHistory";
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
      "List recorded listing decisions, catalog change reviews, and audit closures. Requires administrator privileges.",
    operationId: "listModerationHistory",
  })
  .input(ModerationHistoryListInputSchema)
  .output(ModerationHistoryListResponseSchema)
  .handler(async ({ input }) => {
    const offset = (input.cursor - 1) * input.limit;
    const events = await queryModerationHistory({
      ...input,
      offset,
      limit: input.limit + 1,
    });
    return {
      results: events.slice(0, input.limit),
      rel: {
        nextCursor: events.length > input.limit ? input.cursor + 1 : null,
        prevCursor: input.cursor > 1 ? input.cursor - 1 : null,
      },
    };
  });
