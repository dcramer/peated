import { base } from "../..";
import changeList from "./change-list";
import createBatch from "./create-batch";
import list from "./list";
import update from "./update";

export default base.tag("prices").router({
  list,
  update,
  createBatch,
  changeList,
});
