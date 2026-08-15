import { getUserActor } from "@peated/server/lib/actors";
import { ignoreInconclusiveStorePriceMatchProposals } from "@peated/server/lib/priceMatching";
import { procedure } from "@peated/server/orpc";
import { requireAdmin } from "@peated/server/orpc/middleware";
import { z } from "zod";

export default procedure
  .use(requireAdmin)
  .route({
    method: "POST",
    path: "/admin/moderation/listings/inconclusive/ignore",
    summary: "Ignore inconclusive listing proposals",
    description:
      "Ignore every visible, actionable no-match listing proposal. Requires administrator privileges.",
    operationId: "ignoreInconclusiveModerationListings",
  })
  .input(z.object({}).strict().default({}))
  .output(z.object({ ignored: z.number().int().min(0) }).strict())
  .handler(async ({ context }) => ({
    ignored: await ignoreInconclusiveStorePriceMatchProposals({
      reviewedById: context.user.id,
      actor: await getUserActor(context.user),
    }),
  }));
