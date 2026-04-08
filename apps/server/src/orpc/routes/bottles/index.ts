import { base } from "@peated/server/orpc";
import applyReleaseRepair from "./apply-release-repair";
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
