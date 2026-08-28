import { base } from "@peated/server/orpc";
import activate from "./activate";
import create from "./create";
import createDraft from "./create-draft";
import disable from "./disable";
import list from "./list";
import preview from "./preview";
import suggest from "./suggest";

export default base.router({
  list,
  create,
  createDraft,
  preview,
  activate,
  disable,
  suggest,
});
