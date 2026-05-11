import type {
  BottleClassificationDecision,
  BottleExtractedDetails,
} from "../classifierTypes";
import type {
  BottleClassificationArtifacts,
  BottleReference,
} from "../contract";
import { parseReferenceName as parseSmwsReferenceName } from "../smws";
import { resolveSmwsExactCaskReference } from "../smwsPolicy";

type DeterministicResolver = (input: {
  reference: BottleReference;
  artifacts: BottleClassificationArtifacts;
}) => BottleClassificationDecision | null;

const DETERMINISTIC_RESOLVERS: DeterministicResolver[] = [
  resolveSmwsExactCaskReference,
];

export function getDeterministicIdentitySeed(
  reference: Pick<BottleReference, "name">,
): BottleExtractedDetails | null {
  const smwsReference = parseSmwsReferenceName(reference.name);
  if (!smwsReference) {
    return null;
  }

  return {
    brand: "SMWS",
    bottler: "The Scotch Malt Whisky Society",
    expression: smwsReference.name,
    series: null,
    distillery: smwsReference.distiller ? [smwsReference.distiller] : [],
    category: smwsReference.category,
    stated_age: null,
    abv: null,
    release_year: null,
    vintage_year: null,
    cask_type: null,
    cask_size: null,
    cask_fill: null,
    cask_strength: null,
    single_cask: true,
    edition: smwsReference.code,
  };
}

export function applyDeterministicIdentitySeed({
  reference,
  extractedIdentity,
}: {
  reference: Pick<BottleReference, "name">;
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
    expression: seed.expression,
    distillery:
      extractedIdentity.distillery && extractedIdentity.distillery.length > 0
        ? extractedIdentity.distillery
        : seed.distillery,
    category: extractedIdentity.category ?? seed.category,
    single_cask: true,
    edition: seed.edition,
  };
}

export function resolveDeterministicBottleReference({
  reference,
  artifacts,
}: {
  reference: BottleReference;
  artifacts: BottleClassificationArtifacts;
}): BottleClassificationDecision | null {
  // Only add resolvers here when the result is true from closed syntax or
  // curated reference data alone. Product/source judgment belongs to the agent.
  for (const resolver of DETERMINISTIC_RESOLVERS) {
    const decision = resolver({ reference, artifacts });
    if (decision) {
      return decision;
    }
  }

  return null;
}
