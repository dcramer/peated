import { base } from "../..";
import queueInfo from "./queue-info";
import reviewWorkbenchStats from "./review-workbench-stats";

export default base.tag("admin").router({
  queueInfo,
  reviewWorkbenchStats,
});
