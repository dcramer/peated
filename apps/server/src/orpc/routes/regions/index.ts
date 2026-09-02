import { base } from "@peated/server/orpc";
import categories from "./categories";
import create from "./create";
import delete_ from "./delete";
import details from "./details";
import list from "./list";
import update from "./update";

export default base.tag("regions").router({
  categories,
  details,
  list,
  create,
  update,
  delete: delete_,
});
