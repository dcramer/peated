import { db } from "@peated/server/db";
import { bottleAliases } from "@peated/server/db/schema";
import { formatCategoryName } from "@peated/server/lib/format";
import { getOpenAIEmbedding } from "@peated/server/lib/openaiEmbeddings";
import { eq, sql } from "drizzle-orm";

const CASK_STRENGTH_SEARCH_TERMS =
  "cask strength barrel strength barrel proof full proof natural strength";
const SINGLE_CASK_SEARCH_TERMS = "single cask single barrel";

function formatSearchAbv(abv: number | null | undefined) {
  if (abv === null || abv === undefined) {
    return null;
  }

  return `${abv.toFixed(1)}% ABV`;
}

function formatSearchEnum(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  return value.replace(/_/g, " ");
}

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
      release: true,
      bottle: {
        with: { brand: true },
      },
    },
  });
  if (!alias) {
    throw new Error(`Unknown bottle alias: ${name}`);
  }

  console.log(`Updating index for bottle alias: ${name}`);

  const { bottle, release } = alias;
  const brand = bottle?.brand;
  const bits: string[] = [alias.name];
  if (bottle?.category) bits.push(formatCategoryName(bottle.category));
  if (release?.edition ?? bottle?.edition)
    bits.push(release?.edition ?? bottle!.edition!);
  if (release?.statedAge ?? bottle?.statedAge) {
    bits.push(`${release?.statedAge ?? bottle!.statedAge!}-year-old`);
  }
  if (release?.caskType ?? bottle?.caskType) {
    bits.push(formatSearchEnum(release?.caskType ?? bottle!.caskType)!);
  }
  if (release?.caskStrength ?? bottle?.caskStrength)
    bits.push(CASK_STRENGTH_SEARCH_TERMS);
  if (release?.singleCask ?? bottle?.singleCask)
    bits.push(SINGLE_CASK_SEARCH_TERMS);
  if (release?.vintageYear ?? bottle?.vintageYear) {
    bits.push(`${release?.vintageYear ?? bottle!.vintageYear!} vintage`);
  }
  if (release?.releaseYear ?? bottle?.releaseYear) {
    bits.push(`${release?.releaseYear ?? bottle!.releaseYear!} release`);
  }
  if (release?.abv ?? bottle?.abv) {
    bits.push(formatSearchAbv(release?.abv ?? bottle!.abv)!);
  }
  // shortName is already present in alias.name
  if (brand && brand?.name !== brand?.shortName) bits.unshift(brand.name);
  const embedding = await getOpenAIEmbedding(bits.join(" "));

  await db
    .update(bottleAliases)
    .set({
      embedding,
    })
    .where(eq(sql`LOWER(${bottleAliases.name})`, name.toLowerCase()));
};
