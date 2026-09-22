import { base } from "@peated/server/orpc";
import close from "./close";
import details from "./details";
import list from "./list";

export default base.router({
  close,
  details,
  list,
});
