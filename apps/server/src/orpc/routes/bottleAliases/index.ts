import { base } from "@peated/server/orpc";
import delete_ from "./delete";
import list from "./list";
import update from "./update";
import upsert from "./upsert";

export default base.tag("bottleAliases").router({
  list,
  update,
  delete: delete_,
  upsert,
});
