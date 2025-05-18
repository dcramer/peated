import { base } from "@peated/server/orpc";
import create from "./create";
import details from "./details";
import imageUpdate from "./image-update";
import list from "./list";
import update from "./update";
import userList from "./user-list";

export default base.tag("badges").router({
  details,
  list,
  create,
  update,
  userList,
  imageUpdate,
});
