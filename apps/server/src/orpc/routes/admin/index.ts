import { base } from "../..";
import catalogCoverage from "./catalog-coverage";
import content from "./content";
import moderation from "./moderation";
import oauthClients from "./oauth-clients";
import rebuildBottleSearch from "./rebuild-bottle-search";
import rebuildCatalogSummaries from "./rebuild-catalog-summaries";
import reports from "./reports";
import scraperActivity from "./scraper-activity";

export default base.tag("admin").router({
  catalogCoverage,
  content,
  moderation,
  oauthClients,
  rebuildBottleSearch,
  rebuildCatalogSummaries,
  reports,
  scraperActivity,
});
