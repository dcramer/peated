import { base } from "@peated/server/orpc";
import list from "./list";
import update from "./update";

export default base.tag("admin").router({
  list,
  update,
});
