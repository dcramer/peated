import { base } from "@peated/server/orpc";
import activity from "./activity";
import avatarUpdate from "./avatar-update";
import badgeList from "./badge-list";
import blockCreate from "./block-create";
import blockDelete from "./block-delete";
import blockList from "./block-list";
import deleteUser from "./delete";
import deletionCancel from "./deletion-cancel";
import details from "./details";
import flavorList from "./flavor-list";
import libraryStats from "./library-stats";
import list from "./list";
import regionList from "./region-list";
import suspensionUpdate from "./suspension-update";
import tagList from "./tag-list";
import tastingStats from "./tasting-stats";
import update from "./update";

export default base.tag("users").router({
  activity,
  delete: deleteUser,
  deletionCancel,
  details,
  list,
  update,
  avatarUpdate,
  badgeList,
  blockCreate,
  blockDelete,
  blockList,
  flavorList,
  libraryStats,
  regionList,
  suspensionUpdate,
  tagList,
  tastingStats,
});
