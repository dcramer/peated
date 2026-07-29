import { formatCategoryName } from "@peated/server/lib/format";
import { toTitleCase } from "@peated/server/lib/strings";
import type { ConcreteBottleV1 } from "@peated/server/schemas";
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
>;

type MetadataItem = {
  key: string;
  content: ReactNode;
};

function getBottleExactMetadata(
  bottle: BottleExactMetadataSource,
): MetadataItem[] {
  const metadata: MetadataItem[] = [];

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

  return metadata;
}

export default function BottleExactMetadata({
  bottle,
  leadingContent,
}: {
  bottle: BottleExactMetadataSource;
  leadingContent?: ReactNode;
}) {
  const metadata = getBottleExactMetadata(bottle);
  const items: MetadataItem[] =
    leadingContent !== undefined
      ? [{ key: "leading", content: leadingContent }, ...metadata]
      : metadata;
  if (!items.length) return null;

  return (
    <div className="text-muted mt-1 flex flex-wrap text-sm leading-5">
      {items.map(({ key, content }, index) => (
        <span key={key} className="inline-flex whitespace-nowrap">
          {index ? <span className="mx-1.5">&middot;</span> : null}
          {content}
        </span>
      ))}
    </div>
  );
}
