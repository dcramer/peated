import { base } from "../..";
import resendVerification from "./resend-verification";
import verify from "./verify";

export default base.tag("email").router({
  resendVerification,
  verify,
});
