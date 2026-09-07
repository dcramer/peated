import { base } from "@peated/server/orpc";
import catalogListings from "./catalog-listings";
import config from "./config";
import details from "./details";
import { healthDetails, healthList } from "./health";
import icon from "./icon";
import list from "./list";
import repairWhiskyAdvocateScores from "./repair-whisky-advocate-scores";
import reviewPublication from "./review-publication";
import reviewScoring from "./review-scoring";
import runs from "./runs";
import schedule from "./schedule";
import scrapeSources from "./scrape-sources";
import triggerJob from "./trigger-job";

export default base.tag("sites").router({
  list,
  repairWhiskyAdvocateScores,
  healthList,
  healthDetails,
  icon,
  runs,
  schedule,
  details,
  triggerJob,
  config,
  catalogListings,
  scrapeSources,
  reviewPublication,
  reviewScoring,
});
