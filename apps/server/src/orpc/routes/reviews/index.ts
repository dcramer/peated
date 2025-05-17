import { base } from "../..";
import create from "./create";
import list from "./list";
import update from "./update";

export default base.tag("reviews").router({
  list,
  create,
  update,
});
