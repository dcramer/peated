import { base } from "@peated/server/orpc";
import login from "./login";
import magicLink from "./magic-link";
import me from "./me";
import passwordReset from "./password-reset";
import register from "./register";

export default base.tag("auth").router({
  login,
  me,
  register,
  magicLink,
  passwordReset,
});
