import { formatCategoryName } from "@peated/server/lib/format";
import { toTitleCase } from "@peated/server/lib/strings";
import type { BottleGroupV1, ConcreteBottleV1 } from "@peated/server/schemas";
import classNames from "@peated/web/lib/classNames";
import type { ReactNode } from "react";

export type BottleExactMetadataSource = Pick<
  ConcreteBottleV1,
  | "category"
  | "statedAge"
  | "abv"
  | "vintageYear"
  | "releaseYear"
  | "singleCask"
  | "caskStrength"
  | "caskFill"
  | "caskType"
  | "caskSize"
> & {
  edition?: ConcreteBottleV1["edition"];
  group?: Partial<Pick<BottleGroupV1, "statedAge">>;
};

export type BottleExactMetadataKey =
  | "category"
  | "edition"
  | "age"
  | "abv"
  | "vintage"
  | "release"
  | "single-cask"
  | "cask-strength"
  | "cask-details";

type MetadataItem = {
  key: BottleExactMetadataKey;
  content: ReactNode;
};

export function getBottleExactMetadata(
  bottle: BottleExactMetadataSource,
): MetadataItem[] {
  const metadata: MetadataItem[] = [];

  if (bottle.edition) {
    metadata.push({ key: "edition", content: bottle.edition });
  }

  if (bottle.category) {
    metadata.push({
      key: "category",
      content: formatCategoryName(bottle.category),
    });
  }
  if (bottle.statedAge !== null) {
    metadata.push({ key: "age", content: `${bottle.statedAge} years` });
  }
  if (bottle.abv !== null) {
    metadata.push({ key: "abv", content: `${bottle.abv.toFixed(1)}% ABV` });
  }
  if (bottle.vintageYear !== null) {
    metadata.push({
      key: "vintage",
      content: `${bottle.vintageYear} vintage`,
    });
  }
  if (bottle.releaseYear !== null) {
    metadata.push({
      key: "release",
      content: `${bottle.releaseYear} release`,
    });
  }
  if (bottle.singleCask) {
    metadata.push({ key: "single-cask", content: "Single cask" });
  }
  if (bottle.caskStrength) {
    metadata.push({ key: "cask-strength", content: "Cask strength" });
  }

  const caskDetails = [bottle.caskFill, bottle.caskType, bottle.caskSize]
    .filter((value): value is NonNullable<typeof value> => value !== null)
    .map(toTitleCase)
    .join(" ");
  if (caskDetails) {
    metadata.push({ key: "cask-details", content: `${caskDetails} cask` });
  }

  const seenLabels = new Set<string>();
  return metadata.filter(({ content }) => {
    if (typeof content !== "string") return true;

    const label = content.trim().toLowerCase();
    if (seenLabels.has(label)) return false;

    seenLabels.add(label);
    return true;
  });
}

export function hasBottleExactMetadata(
  bottle: BottleExactMetadataSource,
  exclude: readonly BottleExactMetadataKey[] = [],
) {
  return getBottleExactMetadata(bottle).some(
    ({ key }) => !exclude.includes(key),
  );
}

function getBottleReleaseSummary(
  bottle: BottleExactMetadataSource,
): MetadataItem[] {
  if (!bottle.group) return [];

  const metadata: MetadataItem[] = [];

  if (bottle.edition) {
    metadata.push({ key: "edition", content: bottle.edition });
  }
  if (
    bottle.statedAge !== null &&
    bottle.statedAge !== bottle.group.statedAge
  ) {
    metadata.push({ key: "age", content: `${bottle.statedAge} years` });
  }
  if (bottle.abv !== null) {
    metadata.push({ key: "abv", content: `${bottle.abv.toFixed(1)}% ABV` });
  }
  if (!bottle.edition && bottle.vintageYear !== null) {
    metadata.push({
      key: "vintage",
      content: `${bottle.vintageYear} vintage`,
    });
  }
  if (
    !bottle.edition &&
    bottle.vintageYear === null &&
    bottle.releaseYear !== null
  ) {
    metadata.push({
      key: "release",
      content: `${bottle.releaseYear} release`,
    });
  }

  return metadata.slice(0, 3);
}

export default function BottleExactMetadata({
  bottle,
  className,
  exclude = [],
  leadingContent,
  variant = "full",
}: {
  bottle: BottleExactMetadataSource;
  className?: string;
  exclude?: readonly BottleExactMetadataKey[];
  leadingContent?: ReactNode;
  variant?: "full" | "summary";
}) {
  const excluded = new Set(exclude);
  const metadata = (
    variant === "summary"
      ? getBottleReleaseSummary(bottle)
      : getBottleExactMetadata(bottle)
  ).filter(({ key }) => !excluded.has(key));
  const items: Array<MetadataItem | { key: "leading"; content: ReactNode }> =
    leadingContent !== undefined
      ? [{ key: "leading", content: leadingContent }, ...metadata]
      : metadata;
  if (!items.length) return null;

  return (
    <div
      className={classNames(
        "text-muted mt-1 text-sm leading-5",
        variant === "summary" ? "block truncate" : "flex flex-wrap",
        className,
      )}
    >
      {items.map(({ key, content }, index) => (
        <span key={key} className="inline-flex whitespace-nowrap">
          {index ? <span className="mx-1.5">&middot;</span> : null}
          {content}
        </span>
      ))}
    </div>
  );
}
