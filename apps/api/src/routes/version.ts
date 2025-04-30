import config from "@peated/server/config";
import { publicProcedure } from "../trpc";

export default publicProcedure.query(async function () {
  return {
    version: config.VERSION,
  };
});
