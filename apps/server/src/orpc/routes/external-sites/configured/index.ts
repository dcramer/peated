import { base } from "@peated/server/orpc";
import activate from "./activate";
import create from "./create";
import createDraft from "./create-draft";
import disable from "./disable";
import generate from "./generate";
import list from "./list";
import preview from "./preview";

export default base.router({
  list,
  create,
  createDraft,
  preview,
  activate,
  disable,
  generate,
});
