import { base } from "@peated/server/orpc";
import count from "./count";
import createBottle from "./createBottle";
import delete_ from "./delete";
import details from "./details";
import list from "./list";
import publish from "./publish";
import upsert from "./upsert";

export default base.tag("tastingDrafts").router({
  list,
  count,
  details,
  upsert,
  delete: delete_,
  publish,
  createBottle,
});
