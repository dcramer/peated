import { base } from "@peated/server/orpc";
import login from "./login";
import magicLink from "./magic-link";
import me from "./me";
import passkey from "./passkey";
import recovery from "./recovery";
import register from "./register";
import registerChallenge from "./register-challenge";
import tos from "./tos";

export default base.tag("auth").router({
  login,
  me,
  register,
  registerChallenge,
  magicLink,
  tos,
  recovery,
  passkey,
});
