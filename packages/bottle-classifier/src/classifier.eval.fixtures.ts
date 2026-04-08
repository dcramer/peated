import type { ClassifyBottleReferenceInput } from "./contract";
import type { BottleCandidate, BottleExtractedDetails } from "./schemas";

export type SearchResponseFixture = {
  when: string[];
  results: BottleCandidate[];
};

export type ClassifierEvalExpectation = {
  status: "ignored" | "classified";
  action?:
    | "match"
    | "create_bottle"
    | "create_release"
    | "create_bottle_and_release"
    | "no_match";
  identityScope?: "product" | "exact_cask";
  matchedBottleId?: number | null;
  matchedReleaseId?: number | null;
  parentBottleId?: number | null;
  summary: string;
};

export type ClassifierEvalCase = {
  name: string;
  input: ClassifyBottleReferenceInput;
  searchResponses?: SearchResponseFixture[];
  expected: ClassifierEvalExpectation;
};

function buildBottleCandidate(
  candidate: Pick<BottleCandidate, "bottleId" | "fullName"> &
    Partial<BottleCandidate>,
): BottleCandidate {
  return {
    kind: "bottle",
    releaseId: null,
    alias: null,
    bottleFullName: candidate.fullName,
    brand: null,
    bottler: null,
    series: null,
    distillery: [],
    category: null,
    statedAge: null,
    edition: null,
    caskStrength: null,
    singleCask: null,
    abv: null,
    vintageYear: null,
    releaseYear: null,
    caskType: null,
    caskSize: null,
    caskFill: null,
    score: null,
    source: [],
    ...candidate,
  };
}

function buildExtractedIdentity(
  identity: Partial<BottleExtractedDetails>,
): BottleExtractedDetails {
  return {
    brand: null,
    bottler: null,
    expression: null,
    series: null,
    distillery: [],
    category: null,
    stated_age: null,
    abv: null,
    release_year: null,
    vintage_year: null,
    cask_type: null,
    cask_size: null,
    cask_fill: null,
    cask_strength: null,
    single_cask: null,
    edition: null,
    ...identity,
  };
}

const quintaRubanEditionCandidate = buildBottleCandidate({
  bottleId: 401,
  fullName: "Glenmorangie Quinta Ruban 14 Year Old 4th Edition",
  brand: "Glenmorangie",
  distillery: ["Glenmorangie"],
  category: "single_malt",
  statedAge: 14,
  edition: "4th Edition",
  abv: 46,
  caskType: "ruby_port",
  score: 0.87,
  source: ["vector"],
});

const rareBreedNearMatch = buildBottleCandidate({
  bottleId: 500,
  fullName: "Wild Turkey Rare Breed Barrel Proof",
  brand: "Wild Turkey",
  series: "Rare Breed",
  category: "bourbon",
  caskStrength: true,
  abv: 58.4,
  score: 0.66,
  source: ["vector"],
});

const rareBreedRyeMatch = buildBottleCandidate({
  bottleId: 501,
  fullName: "Wild Turkey Rare Breed Rye Barrel Proof",
  brand: "Wild Turkey",
  series: "Rare Breed",
  category: "rye",
  caskStrength: true,
  abv: 56.1,
  score: 0.93,
  source: ["text"],
});

const smwsRw65Match = buildBottleCandidate({
  bottleId: 610,
  fullName: "SMWS RW6.5 Sauna Smoke",
  brand: "The Scotch Malt Whisky Society",
  bottler: "The Scotch Malt Whisky Society",
  distillery: ["Kyro"],
  category: "rye",
  singleCask: true,
  score: 0.98,
  source: ["exact"],
});

const elijahCraigBarrelProof = buildBottleCandidate({
  bottleId: 620,
  fullName: "Elijah Craig Barrel Proof",
  brand: "Elijah Craig",
  distillery: ["Heaven Hill"],
  category: "bourbon",
  caskStrength: true,
  statedAge: 12,
  score: 0.94,
  source: ["exact"],
});

const ardbegUigeadail = buildBottleCandidate({
  bottleId: 630,
  fullName: "Ardbeg Uigeadail",
  brand: "Ardbeg",
  distillery: ["Ardbeg"],
  category: "single_malt",
  abv: 54.2,
  score: 0.95,
  source: ["exact"],
});

const springbank10 = buildBottleCandidate({
  bottleId: 640,
  fullName: "Springbank 10 Year Old",
  brand: "Springbank",
  distillery: ["Springbank"],
  category: "single_malt",
  statedAge: 10,
  abv: 46,
  score: 0.92,
  source: ["exact"],
});

const smwsa41176Match = buildBottleCandidate({
  bottleId: 650,
  fullName: "SMWS 41.176 Baristaliscious",
  brand: "The Scotch Malt Whisky Society",
  bottler: "The Scotch Malt Whisky Society",
  distillery: ["Dailuaine"],
  category: "single_malt",
  statedAge: 17,
  singleCask: true,
  score: 0.97,
  source: ["exact"],
});

export const EVAL_CASES: ClassifierEvalCase[] = [
  {
    name: "store listing: avoids matching an over-specific local edition candidate",
    input: {
      reference: {
        name: "Glenmorangie Quinta Ruban 14-year-old",
        url: "https://shop.example/products/quinta-ruban-14",
      },
      initialCandidates: [quintaRubanEditionCandidate],
    },
    searchResponses: [
      {
        when: ["quinta", "ruban"],
        results: [quintaRubanEditionCandidate],
      },
    ],
    expected: {
      status: "classified",
      action: "create_bottle",
      identityScope: "product",
      summary:
        "Treat this as the base Glenmorangie Quinta Ruban 14-year-old bottle and avoid falsely matching the unsupported 4th Edition candidate.",
    },
  },
  {
    name: "store listing: uses web evidence plus local follow-up search to recover the right bottle",
    input: {
      reference: {
        name: "Wild Turkey Rare Breed Rye",
        url: "https://shop.example/products/rare-breed-rye",
      },
      extractedIdentity: buildExtractedIdentity({
        brand: "Wild Turkey",
        expression: "Rare Breed Rye",
        category: "rye",
      }),
      initialCandidates: [rareBreedNearMatch],
    },
    searchResponses: [
      {
        when: ["rare breed", "rye", "barrel proof"],
        results: [rareBreedRyeMatch],
      },
      {
        when: ["rare breed", "rye", "cask_strength"],
        results: [rareBreedRyeMatch],
      },
    ],
    expected: {
      status: "classified",
      action: "match",
      identityScope: "product",
      matchedBottleId: 501,
      summary:
        "Use the web to confirm the omitted barrel-proof trait, rerun local search, and match the canonical Wild Turkey Rare Breed Rye Barrel Proof bottle instead of a looser Rare Breed near-match.",
    },
  },
  {
    name: "text-only listing: extracts and recovers Wild Turkey Rare Breed Rye from the title",
    input: {
      reference: {
        name: "Wild Turkey Rare Breed Rye",
        url: "https://shop.example/products/rare-breed-rye",
      },
      initialCandidates: [rareBreedNearMatch],
    },
    searchResponses: [
      {
        when: ["rare breed", "rye", "barrel proof"],
        results: [rareBreedRyeMatch],
      },
      {
        when: ["rare breed", "rye", "cask_strength"],
        results: [rareBreedRyeMatch],
      },
    ],
    expected: {
      status: "classified",
      action: "match",
      identityScope: "product",
      matchedBottleId: 501,
      summary:
        "Extract the product identity from the raw title, then use the web plus local follow-up search to recover the canonical Wild Turkey Rare Breed Rye Barrel Proof bottle safely.",
    },
  },
  {
    name: "SMWS listing: matches an existing exact-cask bottle by code",
    input: {
      reference: {
        name: "SMWS RW6.5 Sauna Smoke",
        url: "https://vault.example/products/smws-rw6-5-sauna-smoke",
      },
      extractedIdentity: buildExtractedIdentity({
        brand: "The Scotch Malt Whisky Society",
        bottler: "The Scotch Malt Whisky Society",
        expression: "RW6.5 Sauna Smoke",
        distillery: ["Kyro"],
        category: "rye",
        single_cask: true,
      }),
      initialCandidates: [smwsRw65Match],
    },
    searchResponses: [
      {
        when: ["rw6.5"],
        results: [smwsRw65Match],
      },
    ],
    expected: {
      status: "classified",
      action: "match",
      identityScope: "exact_cask",
      matchedBottleId: 610,
      summary:
        "Recognize the SMWS code as exact-cask identity and match the existing SMWS RW6.5 Sauna Smoke bottle.",
    },
  },
  {
    name: "text-only SMWS listing: matches an existing exact-cask bottle by code",
    input: {
      reference: {
        name: "SMWS RW6.5 Sauna Smoke",
        url: "https://vault.example/products/smws-rw6-5-sauna-smoke",
      },
      initialCandidates: [smwsRw65Match],
    },
    searchResponses: [
      {
        when: ["rw6.5"],
        results: [smwsRw65Match],
      },
    ],
    expected: {
      status: "classified",
      action: "match",
      identityScope: "exact_cask",
      matchedBottleId: 610,
      summary:
        "Extract the SMWS identity directly from the title text and match the existing exact-cask bottle by code.",
    },
  },
  {
    name: "SMWS listing: creates an exact-cask bottle when the code is missing locally",
    input: {
      reference: {
        name: "SMWS RW6.5 Sauna Smoke",
        url: "https://vault.example/products/smws-rw6-5-sauna-smoke",
      },
      extractedIdentity: buildExtractedIdentity({
        brand: "The Scotch Malt Whisky Society",
        bottler: "The Scotch Malt Whisky Society",
        expression: "RW6.5 Sauna Smoke",
        distillery: ["Kyro"],
        category: "rye",
        single_cask: true,
      }),
      initialCandidates: [],
    },
    expected: {
      status: "classified",
      action: "create_bottle",
      identityScope: "exact_cask",
      summary:
        "Treat the SMWS code as exact-cask identity and create a new exact-cask bottle when no safe local candidate exists.",
    },
  },
  {
    name: "text-only SMWS listing: creates an exact-cask bottle when the code is missing locally",
    input: {
      reference: {
        name: "SMWS RW6.5 Sauna Smoke",
        url: "https://vault.example/products/smws-rw6-5-sauna-smoke",
      },
      initialCandidates: [],
    },
    expected: {
      status: "classified",
      action: "create_bottle",
      identityScope: "exact_cask",
      summary:
        "Extract the SMWS code from raw title text and create the exact-cask bottle when no safe local candidate exists.",
    },
  },
  {
    name: "store listing: creates a release under an existing batchable product",
    input: {
      reference: {
        name: "Elijah Craig Barrel Proof Batch C923",
        url: "https://shop.example/products/elijah-craig-barrel-proof-batch-c923",
      },
      extractedIdentity: buildExtractedIdentity({
        brand: "Elijah Craig",
        expression: "Barrel Proof",
        category: "bourbon",
        stated_age: 12,
        cask_strength: true,
        edition: "Batch C923",
      }),
      initialCandidates: [elijahCraigBarrelProof],
    },
    searchResponses: [
      {
        when: ["elijah", "barrel proof"],
        results: [elijahCraigBarrelProof],
      },
    ],
    expected: {
      status: "classified",
      action: "create_release",
      identityScope: "product",
      parentBottleId: 620,
      summary:
        "Treat Batch C923 as release-level detail under the existing Elijah Craig Barrel Proof bottle instead of creating a whole new bottle.",
    },
  },
  {
    name: "text-only listing: creates a release under Elijah Craig Barrel Proof from raw title text",
    input: {
      reference: {
        name: "Elijah Craig Barrel Proof Batch C923",
        url: "https://shop.example/products/elijah-craig-barrel-proof-batch-c923",
      },
      initialCandidates: [elijahCraigBarrelProof],
    },
    searchResponses: [
      {
        when: ["elijah", "barrel proof"],
        results: [elijahCraigBarrelProof],
      },
    ],
    expected: {
      status: "classified",
      action: "create_release",
      identityScope: "product",
      parentBottleId: 620,
      summary:
        "Extract batch-level identity directly from the title and create a child release beneath the existing Elijah Craig Barrel Proof bottle.",
    },
  },
  {
    name: "store listing: strips retailer suffix noise and matches the canonical bottle",
    input: {
      reference: {
        name: "Ardbeg Uigeadail Single Malt Scotch Whisky 750ml",
        url: "https://shop.example/products/ardbeg-uigeadail-750ml",
      },
      extractedIdentity: buildExtractedIdentity({
        brand: "Ardbeg",
        expression: "Uigeadail",
        category: "single_malt",
        abv: 54.2,
      }),
      initialCandidates: [ardbegUigeadail],
    },
    searchResponses: [
      {
        when: ["ardbeg", "uigeadail"],
        results: [ardbegUigeadail],
      },
    ],
    expected: {
      status: "classified",
      action: "match",
      identityScope: "product",
      matchedBottleId: 630,
      summary:
        "Ignore generic retailer suffixes like Single Malt Scotch Whisky and 750ml, then match the canonical Ardbeg Uigeadail bottle.",
    },
  },
  {
    name: "text-only listing: strips retailer suffix noise and matches Ardbeg Uigeadail",
    input: {
      reference: {
        name: "Ardbeg Uigeadail Single Malt Scotch Whisky 750ml",
        url: "https://shop.example/products/ardbeg-uigeadail-750ml",
      },
      initialCandidates: [ardbegUigeadail],
    },
    searchResponses: [
      {
        when: ["ardbeg", "uigeadail"],
        results: [ardbegUigeadail],
      },
    ],
    expected: {
      status: "classified",
      action: "match",
      identityScope: "product",
      matchedBottleId: 630,
      summary:
        "Extract the canonical bottle identity from a noisy retailer title and match Ardbeg Uigeadail without needing seeded extraction output.",
    },
  },
  {
    name: "user entry: matches a shorthand bottle name",
    input: {
      reference: {
        name: "springbank 10 yo",
      },
      extractedIdentity: buildExtractedIdentity({
        brand: "Springbank",
        expression: "10 Year Old",
        distillery: ["Springbank"],
        category: "single_malt",
        stated_age: 10,
      }),
      initialCandidates: [springbank10],
    },
    searchResponses: [
      {
        when: ["springbank", "10"],
        results: [springbank10],
      },
    ],
    expected: {
      status: "classified",
      action: "match",
      identityScope: "product",
      matchedBottleId: 640,
      summary:
        "Normalize common user shorthand like `10 yo` and match the canonical Springbank 10 Year Old bottle.",
    },
  },
  {
    name: "text-only user entry: matches shorthand Springbank 10",
    input: {
      reference: {
        name: "springbank 10 yo",
      },
      initialCandidates: [springbank10],
    },
    searchResponses: [
      {
        when: ["springbank", "10"],
        results: [springbank10],
      },
    ],
    expected: {
      status: "classified",
      action: "match",
      identityScope: "product",
      matchedBottleId: 640,
      summary:
        "Parse the shorthand user entry directly from text and match the canonical Springbank 10 Year Old bottle.",
    },
  },
  {
    name: "image-backed listing: matches an existing exact-cask bottle from image-first extraction",
    input: {
      reference: {
        name: "SMWS 41.176",
        url: "https://newmake.smwsa.com/products/cask-no-41-176",
        imageUrl:
          "https://optimise2.assets-servd.host/smw-casper/production/product-assets/Bottle%20Images/41.176-US-web.png?w=391&h=1560&auto=compress%2Cformat&fit=crop&dm=1701177310&s=6befd8c2d4b968942ed306a443c5fe2d",
      },
      initialCandidates: [smwsa41176Match],
    },
    searchResponses: [
      {
        when: ["41.176"],
        results: [smwsa41176Match],
      },
    ],
    expected: {
      status: "classified",
      action: "match",
      identityScope: "exact_cask",
      matchedBottleId: 650,
      summary:
        "Use the bottle image and fallback title context to recognize the SMWS 41.176 exact-cask bottle and match the existing candidate safely.",
    },
  },
  {
    name: "store listing: rejects a packaging-only gift set without bottle identity",
    input: {
      reference: {
        name: "Unknown Bottle Gift Set with 2 Glasses",
        url: "https://shop.example/products/unknown-bottle-gift-set",
      },
    },
    expected: {
      status: "ignored",
      summary:
        "Short-circuit packaging-only gift-set listings when the source does not identify a real whisky bottle clearly enough to classify.",
    },
  },
  {
    name: "store listing: ignores a clear non-whisky spirit reference",
    input: {
      reference: {
        name: "Tito's Handmade Vodka",
        url: "https://shop.example/products/titos-handmade-vodka",
      },
    },
    expected: {
      status: "ignored",
      summary:
        "Short-circuit obvious non-whisky spirits instead of searching or trying to classify them as whisky.",
    },
  },
  {
    name: "store listing: rejects a flavored whisky novelty product",
    input: {
      reference: {
        name: "Skrewball Peanut Butter Whiskey",
        url: "https://shop.example/products/skrewball-peanut-butter-whiskey",
      },
    },
    expected: {
      status: "classified",
      action: "no_match",
      summary:
        "Treat flavored whisky novelty products as unsupported and return `no_match` rather than creating or matching a whisky bottle.",
    },
  },
  {
    name: "store listing: rejects a sampler bundle without a single bottle identity",
    input: {
      reference: {
        name: "Single Malt Scotch Whisky Sampler Pack 5 x 50ml",
        url: "https://shop.example/products/single-malt-sampler-pack",
      },
    },
    expected: {
      status: "classified",
      action: "no_match",
      summary:
        "Do not force a bottle identity for a multi-bottle sampler bundle that is not a single canonical whisky record.",
    },
  },
];
