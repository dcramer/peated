import { base } from "../..";
import catalogCoverage from "./catalog-coverage";
import content from "./content";
import moderation from "./moderation";
import oauthClients from "./oauth-clients";
import rebuildCatalogSummaries from "./rebuild-catalog-summaries";
import rebuildSearch from "./rebuild-search";
import reports from "./reports";
import scraperActivity from "./scraper-activity";

export default base.tag("admin").router({
  catalogCoverage,
  content,
  moderation,
  oauthClients,
  rebuildSearch,
  rebuildCatalogSummaries,
  reports,
  scraperActivity,
});
