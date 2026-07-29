import { base } from "@peated/server/orpc";
import bottles from "./bottles";
import details from "./details";

export default base.tag("bottleGroups").router({
  details,
  bottles,
});
