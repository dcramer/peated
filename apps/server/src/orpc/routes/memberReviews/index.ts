import { base } from "@peated/server/orpc";
import delete_ from "./delete";
import list from "./list";
import mine from "./mine";
import upsert from "./upsert";

export default base.tag("member reviews").router({
  list,
  mine,
  upsert,
  delete: delete_,
});
