import { mockEntity } from "@peated/server/orpc/mock/fixtures";
import { mockOS } from "@peated/server/orpc/mock/implementer";

export default mockOS.entities.create.handler(async ({ input }) => ({
  ...mockEntity,
  ...input,
  id: mockEntity.id + 1000,
  country: mockEntity.country,
  region: mockEntity.region,
}));
