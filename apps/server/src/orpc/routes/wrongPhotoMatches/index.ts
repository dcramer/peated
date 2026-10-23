import { base } from "@peated/server/orpc";
import create from "./create";
import update from "./update";

export default base.tag("wrongPhotoMatches").router({
  create,
  update,
});
