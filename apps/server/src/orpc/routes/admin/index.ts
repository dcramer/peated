import { base } from "../..";
import catalogCoverage from "./catalog-coverage";
import catalogImport from "./catalog-import";
import moderation from "./moderation";
import oauthClients from "./oauth-clients";
import referenceAudit from "./reference-audit";

export default base.tag("admin").router({
  catalogImport,
  catalogCoverage,
  moderation,
  oauthClients,
  referenceAudit,
});
