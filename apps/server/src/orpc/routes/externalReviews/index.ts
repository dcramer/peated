import { base } from "@peated/server/orpc";
import activeCritics from "./active-critics";
import create from "./create";
import list from "./list";
import update from "./update";

export default base.tag("external reviews").router({
  activeCritics,
  list,
  create,
  update,
});
