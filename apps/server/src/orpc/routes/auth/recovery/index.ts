import { base } from "@peated/server/orpc";
import challenge from "./challenge";
import confirm from "./confirm";
import confirmPasskey from "./confirm-passkey";
import create from "./create";

export default base.router({
  challenge,
  confirm,
  confirmPasskey,
  create,
});
