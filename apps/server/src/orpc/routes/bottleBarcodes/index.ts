import { base } from "@peated/server/orpc";
import delete_ from "./delete";
import details from "./details";
import list from "./list";
import upsert from "./upsert";

export default base.tag("bottleBarcodes").router({
  list,
  details,
  upsert,
  delete: delete_,
});
