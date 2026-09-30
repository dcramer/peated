import { base } from "@peated/server/orpc";
import list from "./list";
import match from "./match";
import matchQueue from "./matchQueue";
import updateWatch from "./updateWatch";
import watch from "./watch";

export default base
  .tag("auctions")
  .router({ list, match, matchQueue, watch, updateWatch });
