import { implement } from "@orpc/server";
import list from "@peated/server/orpc/routes/activity/list";

export default implement(list).handler(async () => ({
  results: [],
  rel: {
    nextCursor: null,
    prevCursor: null,
  },
}));
