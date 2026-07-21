import { base } from "@peated/server/orpc";
import aliases from "./aliases";
import bottles from "./bottles";
import details from "./details";
import list from "./list";
import merge from "./merge";
import split from "./split";
import updatePresentation from "./update-presentation";

export default base.tag("bottleGroups").router({
  list,
  details,
  bottles,
  aliases,
  merge,
  split,
  updatePresentation,
});
