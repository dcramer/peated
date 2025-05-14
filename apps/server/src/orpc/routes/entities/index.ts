import aliases from "./aliases";
import categories from "./categories";
import create from "./create";
import delete_ from "./delete";
import details from "./details";
import list from "./list";
import merge from "./merge";
import update from "./update";

export default {
  details,
  list,
  create,
  update,
  delete: delete_,
  merge,
  aliases,
  categories,
};
