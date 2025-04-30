import { getQueue } from "@peated/server/worker/client";
import { adminProcedure } from "../trpc";

export default adminProcedure.query(async function () {
  const queue = await getQueue("default");
  const stats = await queue.getJobCounts(
    "wait",
    "active",
    "completed",
    "failed",
  );

  return { stats };
});
