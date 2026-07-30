import { base } from "@peated/server/orpc";
import approveSelected from "./approve-selected";
import audit from "./audit";
import close from "./close";
import details from "./details";
import history from "./history";
import list from "./list";
import rejectSelected from "./reject-selected";
import retry from "./retry";

export default base.tag("bottleChecks").router({
  approveSelected,
  audit,
  close,
  details,
  history,
  list,
  rejectSelected,
  retry,
});
