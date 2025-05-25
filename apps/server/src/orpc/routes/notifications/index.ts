import { base } from "@peated/server/orpc";
import count from "./count";
import delete_ from "./delete";
import list from "./list";
import update from "./update";

export default base.tag("notifications").router({
  count,
  delete: delete_,
  list,
  update,
});
