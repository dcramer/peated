import { procedure } from "@peated/server/orpc";
import { requireAdmin } from "@peated/server/orpc/middleware";
import {
  AdminContentItemSchema,
  AdminContentKindSchema,
} from "@peated/server/schemas";
import { z } from "zod";
import { getAdminContent } from "./data";

export default procedure
  .use(requireAdmin)
  .route({
    method: "GET",
    path: "/admin/content/{kind}/{id}",
    summary: "Get review or tasting content",
    description: "Get one review or tasting for administrator review.",
    operationId: "getAdminContent",
  })
  .input(
    z.object({
      kind: AdminContentKindSchema,
      id: z.coerce.number().int().positive(),
    }),
  )
  .output(AdminContentItemSchema)
  .handler(async ({ input, errors }) => {
    const item = await getAdminContent(input.kind, input.id);
    if (!item) {
      throw errors.NOT_FOUND({ message: "Content not found." });
    }
    return item;
  });
