import { base } from "@peated/server/orpc";
import aliases from "./aliases";
import auditCandidates from "./audit-candidates";
import catalog from "./catalog";
import categories from "./categories";
import classify from "./classify";
import create from "./create";
import delete_ from "./delete";
import details from "./details";
import events from "./events";
import follow from "./follow";
import images from "./images";
import list from "./list";
import merge from "./merge";
import references from "./references";
import resolve from "./resolve";
import unfollow from "./unfollow";
import update from "./update";

export default base.tag("entities").router({
  auditCandidates,
  catalog,
  classify,
  create,
  details,
  update,
  delete: delete_,
  merge,
  aliases,
  references,
  resolve,
  categories,
  events,
  follow,
  images,
  list,
  unfollow,
});
