import { base } from "@peated/server/orpc";
import list from "./list";
import upsert from "./upsert";

export default base.tag("bottleReferences").router({
  list,
  upsert,
});
