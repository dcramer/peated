import { base } from "@peated/server/orpc";
import aliases from "./aliases";
import auditCandidates from "./audit-candidates";
import catalog from "./catalog";
import categories from "./categories";
import classify from "./classify";
import delete_ from "./delete";
import details from "./details";
import events from "./events";
import follow from "./follow";
import merge from "./merge";
import unfollow from "./unfollow";
import update from "./update";

export default base.tag("entities").router({
  auditCandidates,
  catalog,
  classify,
  details,
  update,
  delete: delete_,
  merge,
  aliases,
  categories,
  events,
  follow,
  unfollow,
});
