import { base } from "@peated/server/orpc";
import create from "./create";
import delete_ from "./delete";
import details from "./details";
import list from "./list";
import merge from "./merge";
import update from "./update";

export default base.tag("bottleSeries").router({
  details,
  list,
  create,
  update,
  merge,
  delete: delete_,
});
