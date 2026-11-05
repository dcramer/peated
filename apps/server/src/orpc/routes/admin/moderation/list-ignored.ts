import { queryIgnoredSources } from "@peated/server/lib/moderationIgnored";
import { procedure } from "@peated/server/orpc";
import { requireMod } from "@peated/server/orpc/middleware";
import {
  IgnoredSourceListInputSchema,
  IgnoredSourceListResponseSchema,
} from "./schemas";

export default procedure
  .use(requireMod)
  .route({
    method: "GET",
    path: "/admin/moderation/ignored",
    summary: "List ignored sources",
    description:
      "List store listings, auction lots, and imported reviews that are ignored now, newest first, with the reason from the latest classifier run when that run ignored the source. A null `ignoredBy` means the classifier ignored it. Requires a moderator or administrator.",
    operationId: "listIgnoredSources",
  })
  .input(IgnoredSourceListInputSchema)
  .output(IgnoredSourceListResponseSchema)
  .handler(async ({ input }) => {
    const offset = (input.cursor - 1) * input.limit;
    const results = await queryIgnoredSources({
      ...input,
      offset,
      limit: input.limit + 1,
    });
    return {
      results: results.slice(0, input.limit),
      rel: {
        nextCursor: results.length > input.limit ? input.cursor + 1 : null,
        prevCursor: input.cursor > 1 ? input.cursor - 1 : null,
      },
    };
  });
