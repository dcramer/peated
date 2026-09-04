import { base } from "../..";
import catalogCoverage from "./catalog-coverage";
import convertOldStarRatings from "./convert-old-star-ratings";
import moderation from "./moderation";
import oauthClients from "./oauth-clients";
import getOldStarRatingConversion from "./preview-old-star-rating-conversion";
import repairBottleCounts from "./repair-bottle-counts";

export default base.tag("admin").router({
  catalogCoverage,
  convertOldStarRatings,
  moderation,
  oauthClients,
  repairBottleCounts,
  getOldStarRatingConversion,
});
