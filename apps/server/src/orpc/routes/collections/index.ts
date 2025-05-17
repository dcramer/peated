import { base } from "../..";
import bottles from "./bottles";
import list from "./list";

export default base.tag("collections").router({
  list,
  bottles,
});
