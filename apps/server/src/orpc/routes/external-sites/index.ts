import { base } from "@peated/server/orpc";
import config from "./config";
import details from "./details";
import { healthDetails, healthList } from "./health";
import icon from "./icon";
import list from "./list";
import reviewPublication from "./review-publication";
import runs from "./runs";
import schedule from "./schedule";
import scrapeSources from "./scrape-sources";
import triggerJob from "./trigger-job";

export default base.tag("sites").router({
  list,
  healthList,
  healthDetails,
  icon,
  runs,
  schedule,
  details,
  triggerJob,
  config,
  scrapeSources,
  reviewPublication,
});
