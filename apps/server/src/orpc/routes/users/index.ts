import { base } from "@peated/server/orpc";
import avatarUpdate from "./avatar-update";
import badgeList from "./badge-list";
import details from "./details";
import flavorList from "./flavor-list";
import list from "./list";
import regionList from "./region-list";
import tagList from "./tag-list";
import update from "./update";

export default base.tag("users").router({
  details,
  list,
  update,
  avatarUpdate,
  badgeList,
  flavorList,
  regionList,
  tagList,
});
