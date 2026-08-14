import { base } from "@peated/server/orpc";
import automation from "./automation";
import historyDetails from "./history-details";
import listHistory from "./list-history";
import listTasks from "./list-tasks";
import task from "./task";

export default base.router({
  automation,
  historyDetails,
  listHistory,
  listTasks,
  task,
});
