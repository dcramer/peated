import { procedure } from "@peated/server/orpc";
import { requireMod } from "@peated/server/orpc/middleware";
import { AdminReportSchema } from "@peated/server/schemas";
import { z } from "zod";
import { getAdminReport } from "./data";

export default procedure
  .use(requireMod)
  .route({
    method: "GET",
    path: "/admin/reports/{report}",
    summary: "Get a report",
    description:
      "Get one member report with who sent it, who it is about, and where the content lives. Requires a moderator or administrator.",
    operationId: "getAdminReport",
  })
  .input(z.object({ report: z.coerce.number().int().positive() }))
  .output(AdminReportSchema)
  .handler(async ({ input, errors }) => {
    const report = await getAdminReport(input.report);
    if (!report) {
      throw errors.NOT_FOUND({ message: "Report not found." });
    }
    return report;
  });
