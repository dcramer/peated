import { base } from "../..";
import catalogCoverage from "./catalog-coverage";
import moderation from "./moderation";
import oauthClients from "./oauth-clients";
import rebuildCatalogSummaries from "./rebuild-catalog-summaries";
import scraperActivity from "./scraper-activity";

export default base.tag("admin").router({
  catalogCoverage,
  moderation,
  oauthClients,
  rebuildCatalogSummaries,
  scraperActivity,
});
