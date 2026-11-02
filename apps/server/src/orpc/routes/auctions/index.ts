import { base } from "@peated/server/orpc";
import details from "./details";
import ignore from "./ignore";
import list from "./list";
import match from "./match";
import matchQueue from "./matchQueue";
import recheck from "./recheck";
import reopen from "./reopen";
import updateWatch from "./updateWatch";
import watch from "./watch";

export default base.tag("auctions").router({
  list,
  match,
  ignore,
  reopen,
  matchQueue,
  watch,
  updateWatch,
  details,
  recheck,
});
