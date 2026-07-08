import { base } from "@peated/server/orpc";
import list from "./list";

export default base.tag("activity").router({
  list,
});
