import { implement } from "@orpc/server";
import root from "@peated/server/orpc/routes/root";

export default implement(root).handler(async () => ({
  version: "mock",
}));
