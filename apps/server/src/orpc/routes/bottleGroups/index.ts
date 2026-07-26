import { base } from "@peated/server/orpc";
import bottles from "./bottles";
import details from "./details";
import updatePresentation from "./update-presentation";

export default base.tag("bottleGroups").router({
  details,
  bottles,
  updatePresentation,
});
