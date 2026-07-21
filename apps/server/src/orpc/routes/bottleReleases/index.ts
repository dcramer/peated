import { base } from "@peated/server/orpc";
import create from "./create";
import delete_ from "./delete";
import details from "./details";
import list from "./list";
import target from "./target";
import update from "./update";

export default base.tag("bottleReleases").router({
  details,
  target,
  list,
  create,
  update,
  delete: delete_,
});
