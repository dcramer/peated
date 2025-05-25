import { base } from "@peated/server/orpc";
import categories from "./categories";
import details from "./details";
import list from "./list";
import update from "./update";

export default base.tag("countries").router({
  details,
  list,
  categories,
  update,
});
