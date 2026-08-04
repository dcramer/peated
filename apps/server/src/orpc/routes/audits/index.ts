import { base } from "@peated/server/orpc";
import approveSelected from "./approve-selected";
import close from "./close";
import create from "./create";
import details from "./details";
import list from "./list";
import rejectSelected from "./reject-selected";
import retry from "./retry";

export default base.tag("audits").router({
  approveSelected,
  close,
  create,
  details,
  list,
  rejectSelected,
  retry,
});
