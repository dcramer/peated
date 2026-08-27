import { base } from "@peated/server/orpc";
import create from "./create";
import list from "./list";
import update from "./update";

export default base.tag("external reviews").router({
  list,
  create,
  update,
});
