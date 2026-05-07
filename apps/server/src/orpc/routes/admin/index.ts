import { base } from "../..";
import incomingBottleDecisions from "./incoming-bottle-decisions";
import queueInfo from "./queue-info";
import reviewWorkbenchStats from "./review-workbench-stats";

export default base.tag("admin").router({
  incomingBottleDecisions,
  queueInfo,
  reviewWorkbenchStats,
});
