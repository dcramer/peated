import { base } from "@peated/server/orpc";
import create from "./create";
import list from "./list";

export default base.tag("distilleries").router({ create, list });
