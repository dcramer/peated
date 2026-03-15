import { resolveStorePriceMatchProposal } from "@peated/server/lib/priceMatching";

export default async ({
  priceId,
  force,
  processingToken,
}: {
  priceId: number;
  force?: boolean;
  processingToken?: string;
}) => {
  await resolveStorePriceMatchProposal(priceId, { force, processingToken });
};
