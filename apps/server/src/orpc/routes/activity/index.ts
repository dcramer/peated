import { base } from "@peated/server/orpc";
import list from "./list";
import reviewsAndTastings from "./reviews-and-tastings";

export default base.tag("activity").router({
  list,
  reviewsAndTastings,
});
