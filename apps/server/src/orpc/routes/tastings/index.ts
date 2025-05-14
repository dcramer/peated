import create from "./create";
import delete_ from "./delete";
import details from "./details";
import imageDelete from "./image-delete";
import imageUpdate from "./image-update";
import list from "./list";
import update from "./update";

export default {
  details,
  list,
  create,
  update,
  delete: delete_,
  imageUpdate,
  imageDelete,
};
