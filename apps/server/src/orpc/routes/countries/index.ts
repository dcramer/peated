import { base } from "../..";
import categories from "./categories";
import details from "./details";
import list from "./list";
import regions from "./regions";
import update from "./update";

export default base.tag("countries").router({
  details,
  list,
  categories,
  update,
  regions,
});
