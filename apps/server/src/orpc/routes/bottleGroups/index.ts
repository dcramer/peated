import { base } from "@peated/server/orpc";
import aliases from "./aliases";
import bottles from "./bottles";
import details from "./details";
import updatePresentation from "./update-presentation";

export default base.tag("bottleGroups").router({
  details,
  bottles,
  aliases,
  updatePresentation,
});
