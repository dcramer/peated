import { base } from "@peated/server/orpc";
import delete_ from "./delete";
import getMy from "./getMy";
import imageDelete from "./image-delete";
import imageUpdate from "./image-update";
import list from "./list";
import save from "./save";

export default base.tag("member reviews").router({
  list,
  getMy,
  imageUpdate,
  imageDelete,
  save,
  delete: delete_,
});
