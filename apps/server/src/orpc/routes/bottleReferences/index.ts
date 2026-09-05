import { base } from "@peated/server/orpc";
import details from "./details";
import list from "./list";
import update from "./update";
import upsert from "./upsert";

export default base.tag("bottleReferences").router({
  details,
  list,
  update,
  upsert,
});
