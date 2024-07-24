import { adminProcedure } from "..";

export default adminProcedure.query(async function () {
  // const client = await getClient();
  // const info = await client.info();
  // return info;
  return { stats: {} } as {
    stats: Record<string, number>;
  };
});
