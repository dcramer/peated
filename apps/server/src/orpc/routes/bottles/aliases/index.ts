import delete_ from "./delete";
import list from "./list";
import update from "./update";
import upsert from "./upsert";

export default {
  list,
  update,
  delete: delete_,
  upsert,
};
