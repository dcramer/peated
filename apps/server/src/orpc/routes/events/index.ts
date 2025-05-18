import { base } from "@peated/server/orpc";
import create from "./create";
import details from "./details";
import list from "./list";
import update from "./update";

export default base.tag("events").router({
  details,
  list,
  create,
  update,
});
