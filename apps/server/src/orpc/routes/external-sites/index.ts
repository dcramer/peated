import { base } from "../..";
import config from "./config";
import create from "./create";
import details from "./details";
import list from "./list";
import triggerJob from "./trigger-job";
import update from "./update";

export default base.tag("sites").router({
  list,
  create,
  details,
  update,
  triggerJob,
  config,
});
