import { resolveStorePriceMatchProposal } from "@peated/server/lib/priceMatching";

export default async ({
  priceId,
  force,
  generateBottleCheck,
  processingToken,
}: {
  priceId: number;
  force?: boolean;
  generateBottleCheck?: boolean;
  processingToken?: string;
}) => {
  await resolveStorePriceMatchProposal(priceId, {
    force,
    generateBottleCheck,
    processingToken,
  });
};
