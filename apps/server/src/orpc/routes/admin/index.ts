import { base } from "../..";
import catalogCoverage from "./catalog-coverage";
import moderation from "./moderation";
import oauthClients from "./oauth-clients";
import repairBottleCounts from "./repair-bottle-counts";

export default base.tag("admin").router({
  catalogCoverage,
  moderation,
  oauthClients,
  repairBottleCounts,
});
