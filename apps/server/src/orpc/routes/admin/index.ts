import { base } from "../..";
import catalogCoverage from "./catalog-coverage";
import moderation from "./moderation";
import oauthClients from "./oauth-clients";

export default base.tag("admin").router({
  catalogCoverage,
  moderation,
  oauthClients,
});
