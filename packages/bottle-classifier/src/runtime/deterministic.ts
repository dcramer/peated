import type { BottleExtractedDetails } from "../classifierTypes";
import type { BottleReferenceInput } from "../contract";
import { parseReferenceName as parseSmwsReferenceName } from "../smws";

/**
 * Returns the facts an SMWS code proves on its own: the Society as Brand and
 * bottler, the code as the cask, and the distillery and category from the
 * curated code table. Bottle Classifier rule (owner: classifier): an SMWS code
 * is a verified fact for the agent, not a decision. The agent still matches,
 * creates, and names the Bottle, and only it can read a subtitle.
 */
export function getDeterministicIdentitySeed(
  reference: Pick<BottleReferenceInput, "name">,
): BottleExtractedDetails | null {
  const smwsReference = parseSmwsReferenceName(reference.name);
  if (!smwsReference) {
    return null;
  }

  return {
    brand: "SMWS",
    bottler: "The Scotch Malt Whisky Society",
    expression: null,
    series: null,
    distillery: smwsReference.distiller ? [smwsReference.distiller] : [],
    category: smwsReference.category,
    stated_age: null,
    abv: null,
    release_year: null,
    release_month: null,
    release_day: null,
    vintage_year: null,
    cask_strength: null,
    single_cask: true,
    maturation: null,
    cask_number: smwsReference.code,
    outturn: null,
    edition: null,
  };
}

export function applyDeterministicIdentitySeed({
  reference,
  extractedIdentity,
}: {
  reference: Pick<BottleReferenceInput, "name">;
  extractedIdentity: BottleExtractedDetails | null;
}): BottleExtractedDetails | null {
  const seed = getDeterministicIdentitySeed(reference);
  if (!seed) {
    return extractedIdentity;
  }

  if (!extractedIdentity) {
    return seed;
  }

  return {
    ...extractedIdentity,
    brand: seed.brand,
    bottler: extractedIdentity.bottler ?? seed.bottler,
    distillery:
      extractedIdentity.distillery && extractedIdentity.distillery.length > 0
        ? extractedIdentity.distillery
        : seed.distillery,
    category: extractedIdentity.category ?? seed.category,
    single_cask: true,
    cask_number: seed.cask_number,
  };
}
