import { procedure } from "@peated/server/orpc";
import { requireMod } from "@peated/server/orpc/middleware";
import {
  AdminReportListInputSchema,
  AdminReportSchema,
  CursorSchema,
} from "@peated/server/schemas";
import { z } from "zod";
import { listAdminReports } from "./data";

export default procedure
  .use(requireMod)
  .route({
    method: "GET",
    path: "/admin/reports",
    summary: "List reports",
    description:
      "List member reports of content or members. Open reports come oldest first; closed reports come most recently closed first. Requires a moderator or administrator.",
    operationId: "listAdminReports",
  })
  .input(AdminReportListInputSchema)
  .output(
    z.object({
      results: z.array(AdminReportSchema),
      rel: CursorSchema,
    }),
  )
  .handler(async ({ input }) => listAdminReports(input));
