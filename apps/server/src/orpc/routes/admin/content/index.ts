import { base } from "@peated/server/orpc";
import details from "./details";
import list from "./list";
import moderate from "./moderate";

export default base.tag("admin content").router({
  details,
  list,
  moderate,
});
