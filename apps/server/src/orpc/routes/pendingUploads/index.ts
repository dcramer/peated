import { base } from "@peated/server/orpc";
import create from "./create";

export default base.tag("pendingUploads").router({
  create,
});
