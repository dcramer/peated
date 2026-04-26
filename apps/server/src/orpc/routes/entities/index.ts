import { base } from "@peated/server/orpc";
import aliases from "./aliases";
import auditCandidates from "./audit-candidates";
import categories from "./categories";
import classify from "./classify";
import create from "./create";
import delete_ from "./delete";
import details from "./details";
import list from "./list";
import merge from "./merge";
import update from "./update";

export default base.tag("entities").router({
  auditCandidates,
  classify,
  details,
  list,
  create,
  update,
  delete: delete_,
  merge,
  aliases,
  categories,
});
