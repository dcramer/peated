import config from "@peated/server/config";
import { implement } from "@peated/server/orpc";
import rootContract from "@peated/server/orpc/contracts/root";

export default implement(rootContract).handler(async function () {
  return {
    version: config.VERSION,
  };
});
