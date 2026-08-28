import { base } from "@peated/server/orpc";
import delete_ from "./delete";
import getMy from "./getMy";
import list from "./list";
import save from "./save";

export default base.tag("member reviews").router({
  list,
  getMy,
  save,
  delete: delete_,
});
