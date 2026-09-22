import { getUserActor } from "@peated/server/lib/actors";
import { ignoreInconclusiveStorePriceMatchProposals } from "@peated/server/lib/priceMatching";
import { procedure } from "@peated/server/orpc";
import { requireMod } from "@peated/server/orpc/middleware";
import { z } from "zod";

export default procedure
  .use(requireMod)
  .route({
    method: "POST",
    path: "/admin/moderation/listings/inconclusive/ignore",
    summary: "Ignore inconclusive listing proposals",
    description:
      "Ignore every visible, actionable no-match listing proposal. Requires a moderator or administrator.",
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
