import { base } from "../..";
import catalogCoverage from "./catalog-coverage";
import clearBottleDescriptions from "./clear-bottle-descriptions";
import clearEntityDescriptions from "./clear-entity-descriptions";
import clearGuessedEntityDetails from "./clear-guessed-entity-details";
import content from "./content";
import moderation from "./moderation";
import oauthClients from "./oauth-clients";
import rebuildCatalogSummaries from "./rebuild-catalog-summaries";
import rebuildPronunciationAudio from "./rebuild-pronunciation-audio";
import rebuildSearch from "./rebuild-search";
import reports from "./reports";
import scraperActivity from "./scraper-activity";
import writeEntityAbout from "./write-entity-about";
import wrongPhotoMatches from "./wrongPhotoMatches";

export default base.tag("admin").router({
  clearBottleDescriptions,
  clearEntityDescriptions,
  clearGuessedEntityDetails,
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
  writeEntityAbout,
});
