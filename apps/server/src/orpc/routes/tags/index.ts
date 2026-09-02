import { base } from "@peated/server/orpc";
import bottles from "./bottles";
import create from "./create";
import details from "./details";
import list from "./list";
import update from "./update";

export default base.tag("tags").router({
  bottles,
  details,
  create,
  list,
  update,
});
