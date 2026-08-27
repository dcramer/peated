import { mockOS } from "@peated/server/orpc/mock/implementer";

export default mockOS.root.handler(async () => ({
  version: "mock",
}));
