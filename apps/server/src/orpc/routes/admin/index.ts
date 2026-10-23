import { base } from "../..";
import backfillEntityAbout from "./backfill-entity-about";
import catalogCoverage from "./catalog-coverage";
import content from "./content";
import moderation from "./moderation";
import oauthClients from "./oauth-clients";
import rebuildCatalogSummaries from "./rebuild-catalog-summaries";
import rebuildPronunciationAudio from "./rebuild-pronunciation-audio";
import rebuildSearch from "./rebuild-search";
import reports from "./reports";
import scraperActivity from "./scraper-activity";
import wrongPhotoMatches from "./wrongPhotoMatches";

export default base.tag("admin").router({
  backfillEntityAbout,
  catalogCoverage,
  content,
  moderation,
  oauthClients,
  rebuildSearch,
  rebuildCatalogSummaries,
  rebuildPronunciationAudio,
  reports,
  scraperActivity,
  wrongPhotoMatches,
});
