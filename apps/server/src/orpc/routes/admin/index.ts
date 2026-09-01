import { base } from "../..";
import catalogCoverage from "./catalog-coverage";
import moderation from "./moderation";
import oauthClients from "./oauth-clients";
import referenceAudit from "./reference-audit";

export default base.tag("admin").router({
  catalogCoverage,
  moderation,
  oauthClients,
  referenceAudit,
});
