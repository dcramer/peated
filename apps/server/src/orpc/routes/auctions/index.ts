import { base } from "@peated/server/orpc";
import details from "./details";
import list from "./list";
import match from "./match";
import matchQueue from "./matchQueue";
import recheck from "./recheck";
import updateWatch from "./updateWatch";
import watch from "./watch";

export default base
  .tag("auctions")
  .router({ list, match, matchQueue, watch, updateWatch, details, recheck });
