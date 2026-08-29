import { base } from "@peated/server/orpc";
import activate from "./activate";
import create from "./create";
import createRevision from "./create-revision";
import list from "./list";
import pause from "./pause";
import preview from "./preview";
import suggest from "./suggest";

export default base.router({
  list,
  create,
  createRevision,
  preview,
  activate,
  pause,
  suggest,
});
