import type { BottleFormInitialData } from "@peated/web/components/bottleForm";
import { buildBottleProposalDraft } from "@peated/web/lib/bottleProposalDraft";

const MAX_LEADING_ENTITY_WORDS = 6;

export function getLeadingEntityPrefixes(name: string): string[] {
  const words = name.trim().split(/\s+/);
  const prefixWordCount = Math.min(words.length - 1, MAX_LEADING_ENTITY_WORDS);

  return Array.from({ length: Math.max(0, prefixWordCount) }, (_, index) =>
    words.slice(0, prefixWordCount - index).join(" "),
  );
}

export function applyLeadingBrandMatch<T extends { name: string }>(
  initialData: BottleFormInitialData,
  matches: ReadonlyArray<{
    prefix: string;
    results: readonly T[];
  }>,
): BottleFormInitialData {
  if (initialData.brand || !initialData.name) return initialData;

  const normalizedName = initialData.name.trim().replace(/\s+/g, " ");
  // Whisky Identity Model: only one stored Entity reference may prefill Brand.
  const match = matches.find(({ prefix, results }) => {
    const normalizedPrefix = prefix.trim().replace(/\s+/g, " ");
    return (
      results.length === 1 &&
      normalizedName
        .toLocaleLowerCase()
        .startsWith(`${normalizedPrefix.toLocaleLowerCase()} `)
    );
  });
  const brand = match?.results[0];
  if (!match || !brand) return initialData;

  const name = normalizedName
    .slice(match.prefix.trim().replace(/\s+/g, " ").length)
    .replace(/^[\s:–—|/-]+/, "");
  if (!name) return initialData;

  return { ...initialData, brand, name };
}

export function mergeCreateBottleInitialData({
  initialData,
  proposalData,
  proposalImageUrl,
  distiller,
  brand,
  bottler,
  series,
}: {
  initialData: BottleFormInitialData;
  proposalData?: BottleFormInitialData | null;
  proposalImageUrl?: string | null;
  distiller?: NonNullable<BottleFormInitialData["distillers"]>[number];
  brand?: BottleFormInitialData["brand"];
  bottler?: BottleFormInitialData["bottler"];
  series?: BottleFormInitialData["series"];
}): BottleFormInitialData {
  const draft = buildBottleProposalDraft({
    sourceBottle: initialData,
    proposedBottle: proposalData,
  });

  return {
    ...draft,
    imageUrl: proposalImageUrl ?? initialData.imageUrl,
    distillers: distiller ? [distiller] : (draft.distillers ?? []),
    brand: brand ?? draft.brand,
    bottler: bottler ?? draft.bottler,
    series: series ?? draft.series,
  };
}
