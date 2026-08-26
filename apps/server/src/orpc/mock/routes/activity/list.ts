import { mockOS } from "@peated/server/orpc/mock/implementer";

export default mockOS.activity.list.handler(async () => ({
  results: [],
  rel: {
    nextCursor: null,
    prevCursor: null,
  },
}));
