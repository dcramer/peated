import aliases from "./aliases";
import create from "./create";
import delete_ from "./delete";
import details from "./details";
import imageUpdate from "./image-update";
import list from "./list";
import merge from "./merge";
import prices from "./prices";
import releases from "./releases";
import series from "./series";
import similar from "./similar";
import suggestedTags from "./suggested-tags";
import tags from "./tags";
import unmatched from "./unmatched";
import update from "./update";
import upsert from "./upsert";
import validation from "./validation";

export default {
  details,
  list,
  create,
  update,
  delete: delete_,
  merge,
  validation,
  similar,
  tags,
  suggestedTags,
  imageUpdate,
  upsert,
  unmatched,
  aliases,
  releases,
  series,
  prices,
};
