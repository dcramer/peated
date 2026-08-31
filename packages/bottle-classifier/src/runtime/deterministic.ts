import type {
  BottleClassificationDecision,
  BottleExtractedDetails,
} from "../classifierTypes";
import type {
  BottleClassificationArtifacts,
  BottleReferenceInput,
} from "../contract";
import { parseReferenceName as parseSmwsReferenceName } from "../smws";
import { resolveSmwsExactCaskReference } from "../smwsPolicy";

type DeterministicResolver = (input: {
  reference: BottleReferenceInput;
  artifacts: BottleClassificationArtifacts;
}) => BottleClassificationDecision | null;

const DETERMINISTIC_RESOLVERS: DeterministicResolver[] = [
  resolveSmwsExactCaskReference,
];

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
    expression: smwsReference.name,
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
    edition: smwsReference.code,
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
  reference: BottleReferenceInput;
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
