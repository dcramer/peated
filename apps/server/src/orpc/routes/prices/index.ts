import { base } from "@peated/server/orpc";
import changeList from "./change-list";
import createBatch from "./create-batch";
import identityCoverage from "./identity-coverage";
import list from "./list";
import matchQueue from "./matchQueue";
import update from "./update";

export default base.tag("prices").router({
  list,
  update,
  createBatch,
  identityCoverage,
  changeList,
  matchQueue,
});
