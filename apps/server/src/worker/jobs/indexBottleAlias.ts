import { openai } from "@ai-sdk/openai";
import { db } from "@peated/server/db";
import { bottleAliases } from "@peated/server/db/schema";
import { formatCategoryName } from "@peated/server/lib/format";
import { embed } from "ai";
import { eq, sql } from "drizzle-orm";

// capture embeddings at an Alias level as they're unique entities and portable
// note: we may find this is not effective, and the algo would perform better if it
// was done at the bottle level, aggregating all the possible names under it. I dont
// know the underlying math well enough to understand if that would bias the weights in
// a negative way with more aliases.
export default async ({ name }: { name: string }) => {
  const alias = await db.query.bottleAliases.findFirst({
    where: (bottleAliases, { eq }) =>
      eq(sql`LOWER(${bottleAliases.name})`, name.toLowerCase()),
    with: {
      bottle: {
        with: { brand: true },
      },
    },
  });
  if (!alias) {
    throw new Error(`Unknown bottle alias: ${name}`);
  }

  console.log(`Updating index for bottle alias: ${name}`);

  const { bottle } = alias;
  const brand = bottle?.brand;
  const bits: string[] = [alias.name];
  if (bottle?.category) bits.push(formatCategoryName(bottle.category));
  // shortName is already present in alias.name
  if (brand && brand?.name !== brand?.shortName) bits.unshift(brand.name);
  const { embedding } = await embed({
    model: openai.embedding("text-embedding-3-large"),
    value: bits.join(" "),
  });

  await db
    .update(bottleAliases)
    .set({
      embedding,
    })
    .where(eq(sql`LOWER(${bottleAliases.name})`, name.toLowerCase()));
};
