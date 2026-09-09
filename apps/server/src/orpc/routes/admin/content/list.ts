import { procedure } from "@peated/server/orpc";
import { requireAdmin } from "@peated/server/orpc/middleware";
import {
  AdminContentKindSchema,
  AdminContentListItemSchema,
  AdminContentStatusSchema,
  listResponse,
} from "@peated/server/schemas";
import { z } from "zod";
import { listAdminContent } from "./data";

export default procedure
  .use(requireAdmin)
  .route({
    method: "GET",
    path: "/admin/content",
    summary: "List reviews or tastings",
    description:
      "List member reviews, critic reviews, or tastings for administrator review.",
    operationId: "listAdminContent",
  })
  .input(
    z
      .object({
        kind: AdminContentKindSchema,
        status: AdminContentStatusSchema.default("active"),
        query: z.string().trim().max(200).default(""),
        cursor: z.coerce.number().int().positive().default(1),
        limit: z.coerce.number().int().min(1).max(100).default(25),
      })
      .strict(),
  )
  .output(listResponse(AdminContentListItemSchema))
  .handler(async ({ input }) => {
    const { hasNext, results } = await listAdminContent(input);
    return {
      results,
      rel: {
        nextCursor: hasNext ? input.cursor + 1 : null,
        prevCursor: input.cursor > 1 ? input.cursor - 1 : null,
      },
    };
  });
