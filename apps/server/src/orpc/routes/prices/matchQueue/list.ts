import { db } from "@peated/server/db";
import {
  externalSites,
  storePriceMatchProposals,
  storePrices,
} from "@peated/server/db/schema";
import { getProposalBottles } from "@peated/server/lib/priceMatching";
import { procedure } from "@peated/server/orpc";
import { requireMod } from "@peated/server/orpc/middleware";
import { StorePriceMatchQueueListResponse } from "@peated/server/schemas";
import { and, desc, eq, ilike, inArray } from "drizzle-orm";
import { z } from "zod";
import { serializeQueueItems } from "./utils";

export default procedure
  .use(requireMod)
  .route({
    method: "GET",
    path: "/prices/match-queue",
    summary: "List price match queue items",
    description:
      "Retrieve pending or errored store price match proposals for moderator review. Requires moderator privileges",
    operationId: "listPriceMatchQueue",
  })
  .input(
    z
      .object({
        query: z.string().default(""),
        cursor: z.coerce.number().gte(1).default(1),
        limit: z.coerce.number().gte(1).lte(100).default(50),
      })
      .default({
        query: "",
        cursor: 1,
        limit: 50,
      }),
  )
  .output(StorePriceMatchQueueListResponse)
  .handler(async function ({ input, context }) {
    const offset = (input.cursor - 1) * input.limit;

    const rows = await db
      .select({
        proposal: storePriceMatchProposals,
        price: storePrices,
        site: externalSites,
      })
      .from(storePriceMatchProposals)
      .innerJoin(
        storePrices,
        eq(storePrices.id, storePriceMatchProposals.priceId),
      )
      .innerJoin(
        externalSites,
        eq(externalSites.id, storePrices.externalSiteId),
      )
      .where(
        and(
          eq(storePrices.hidden, false),
          inArray(storePriceMatchProposals.status, [
            "pending_review",
            "errored",
          ]),
          input.query ? ilike(storePrices.name, `%${input.query}%`) : undefined,
        ),
      )
      .orderBy(desc(storePriceMatchProposals.updatedAt))
      .limit(input.limit + 1)
      .offset(offset);

    const hasNextPage = rows.length > input.limit;
    const queueRows = rows.slice(0, input.limit).map((row) => ({
      proposal: row.proposal,
      price: {
        ...row.price,
        externalSite: row.site,
      },
    }));

    const bottleList = await getProposalBottles(
      queueRows.map((row) => row.proposal),
    );

    return {
      results: await serializeQueueItems(queueRows, bottleList, context),
      rel: {
        nextCursor: hasNextPage ? input.cursor + 1 : null,
        prevCursor: input.cursor > 1 ? input.cursor - 1 : null,
      },
    };
  });
