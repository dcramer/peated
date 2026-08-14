import { base } from "../..";
import moderation from "./moderation";
import oauthClients from "./oauth-clients";

export default base.tag("admin").router({
  moderation,
  oauthClients,
});
