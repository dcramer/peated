import { base } from "@peated/server/orpc";

import authenticateChallenge from "./authenticate-challenge";
import authenticateVerify from "./authenticate-verify";
import deletePasskey from "./delete";
import list from "./list";
import registerChallenge from "./register-challenge";
import registerVerify from "./register-verify";
import update from "./update";

export default base.router({
  authenticateChallenge,
  authenticateVerify,
  delete: deletePasskey,
  list,
  registerChallenge,
  registerVerify,
  update,
});
