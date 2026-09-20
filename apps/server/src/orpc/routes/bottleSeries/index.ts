import { base } from "@peated/server/orpc";
import create from "./create";
import delete_ from "./delete";
import details from "./details";
import flavorProfile from "./flavor-profile";
import list from "./list";
import merge from "./merge";
import rating from "./rating";
import update from "./update";

export default base.tag("bottleSeries").router({
  details,
  flavorProfile,
  rating,
  list,
  create,
  update,
  merge,
  delete: delete_,
});
