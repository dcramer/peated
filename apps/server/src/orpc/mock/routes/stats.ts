import { mockStats } from "@peated/server/orpc/mock/fixtures";
import { mockOS } from "@peated/server/orpc/mock/implementer";

export default mockOS.stats.handler(async () => mockStats);
