import { base } from "@peated/server/orpc";
import bottle from "./bottle";
import delete_ from "./delete";
import details from "./details";
import list from "./list";
import update from "./update";

export default base.tag("bottleReleases").router({
  bottle,
  details,
  list,
  update,
  delete: delete_,
});
