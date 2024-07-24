import { getQueue } from "@peated/server/worker/client";
import { adminProcedure } from "..";

export default adminProcedure.query(async function () {
  // const client = await getClient();
  // const info = await client.info();
  // return info;
  const stats = await (
    await getQueue("default")
  ).getJobCounts("wait", "active", "completed", "failed");

  return { stats };
});
