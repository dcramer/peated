import { base } from "@peated/server/orpc";
import config from "./config";
import details from "./details";
import { healthDetails, healthList } from "./health";
import list from "./list";
import reviewPolicy from "./review-policy";
import runs from "./runs";
import triggerJob from "./trigger-job";

export default base.tag("sites").router({
  list,
  healthList,
  healthDetails,
  runs,
  details,
  triggerJob,
  config,
  reviewPolicy,
});
