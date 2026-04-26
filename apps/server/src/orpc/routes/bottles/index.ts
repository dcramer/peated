import { base } from "@peated/server/orpc";
import ageRepairCandidates from "./age-repair-candidates";
import applyAgeRepair from "./apply-age-repair";
import applyBrandRepair from "./apply-brand-repair";
import applyBrandRepairGroup from "./apply-brand-repair-group";
import applyDirtyParentReleaseRepair from "./apply-dirty-parent-release-repair";
import applyReleaseRepair from "./apply-release-repair";
import brandRepairCandidates from "./brand-repair-candidates";
import brandRepairGroups from "./brand-repair-groups";
import canonRepairCandidates from "./canon-repair-candidates";
import create from "./create";
import delete_ from "./delete";
import details from "./details";
import imageUpdate from "./image-update";
import list from "./list";
import merge from "./merge";
import prices from "./prices";
import releaseRepairCandidates from "./release-repair-candidates";
import similar from "./similar";
import suggestedTags from "./suggested-tags";
import tags from "./tags";
import update from "./update";
import upsert from "./upsert";
import validation from "./validation";

export default base.tag("bottles").router({
  details,
  list,
  create,
  update,
  canonRepairCandidates,
  brandRepairCandidates,
  brandRepairGroups,
  ageRepairCandidates,
  applyAgeRepair,
  applyBrandRepair,
  applyBrandRepairGroup,
  applyDirtyParentReleaseRepair,
  applyReleaseRepair,
  delete: delete_,
  merge,
  validation,
  releaseRepairCandidates,
  similar,
  tags,
  suggestedTags,
  imageUpdate,
  upsert,
  prices,
});
