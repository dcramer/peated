import { base } from "@peated/server/orpc";
import create from "./create";
import list from "./list";
import recent from "./recent";
import update from "./update";

export default base.tag("reviews").router({
  list,
  recent,
  create,
  update,
});
