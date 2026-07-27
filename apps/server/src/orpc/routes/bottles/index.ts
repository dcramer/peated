import { base } from "@peated/server/orpc";
import applyBrandRepair from "./apply-brand-repair";
import applyBrandRepairGroup from "./apply-brand-repair-group";
import brandRepairCandidates from "./brand-repair-candidates";
import brandRepairGroups from "./brand-repair-groups";
import create from "./create";
import delete_ from "./delete";
import details from "./details";
import editContext from "./edit-context";
import imageUpdate from "./image-update";
import list from "./list";
import merge from "./merge";
import pageTarget from "./page-target";
import prices from "./prices";
import similar from "./similar";
import suggestedTags from "./suggested-tags";
import tags from "./tags";
import target from "./target";
import update from "./update";
import upsert from "./upsert";
import validation from "./validation";

export default base.tag("bottles").router({
  details,
  list,
  create,
  update,
  editContext,
  brandRepairCandidates,
  brandRepairGroups,
  applyBrandRepair,
  applyBrandRepairGroup,
  delete: delete_,
  merge,
  validation,
  similar,
  tags,
  target,
  pageTarget,
  suggestedTags,
  imageUpdate,
  upsert,
  prices,
});
