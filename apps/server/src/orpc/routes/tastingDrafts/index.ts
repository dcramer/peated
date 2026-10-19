import { base } from "@peated/server/orpc";
import createBottle from "./createBottle";
import delete_ from "./delete";
import details from "./details";
import list from "./list";
import publish from "./publish";
import upsert from "./upsert";

export default base.tag("tastingDrafts").router({
  list,
  details,
  upsert,
  delete: delete_,
  publish,
  createBottle,
});
