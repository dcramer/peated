import { base } from "@peated/server/orpc";
import authorizationDetails from "./authorization-details";
import authorize from "./authorize";

export default base.tag("oauth").router({
  authorizationDetails,
  authorize,
});
