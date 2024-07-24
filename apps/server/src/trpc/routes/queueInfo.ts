import { defaultQueue } from "@peated/server/worker/queues";
import { adminProcedure } from "..";

export default adminProcedure.query(async function () {
  // const client = await getClient();
  // const info = await client.info();
  // return info;
  const stats = await defaultQueue.getJobCounts(
    "wait",
    "active",
    "completed",
    "failed",
  );

  return { stats };
});
