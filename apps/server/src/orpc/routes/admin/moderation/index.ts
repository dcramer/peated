import { base } from "@peated/server/orpc";
import automation from "./automation";
import historyDetails from "./history-details";
import ignoreInconclusive from "./ignore-inconclusive";
import listHistory from "./list-history";
import listTasks from "./list-tasks";
import task from "./task";

export default base.router({
  automation,
  historyDetails,
  ignoreInconclusive,
  listHistory,
  listTasks,
  task,
});
