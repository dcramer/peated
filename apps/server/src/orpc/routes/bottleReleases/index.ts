import { base } from "@peated/server/orpc";
import delete_ from "./delete";
import details from "./details";
import list from "./list";
import target from "./target";
import update from "./update";

export default base.tag("bottleReleases").router({
  details,
  target,
  list,
  update,
  delete: delete_,
});
