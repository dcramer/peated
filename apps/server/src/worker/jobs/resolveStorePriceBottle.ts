import { resolveStorePriceMatchProposal } from "@peated/server/lib/priceMatching";

export default async ({
  priceId,
  force,
}: {
  priceId: number;
  force?: boolean;
}) => {
  await resolveStorePriceMatchProposal(priceId, { force });
};
