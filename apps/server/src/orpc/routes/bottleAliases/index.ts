import { base } from "@peated/server/orpc";
import create from "./create";
import delete_ from "./delete";
import list from "./list";

export default base
  .tag("bottleAliases")
  .router({ create, delete: delete_, list });
