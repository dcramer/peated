import type { Bottle } from "@peated/server/types";
import Link from "@peated/web/components/link";
import type { ReactNode } from "react";
import BottleExactMetadata, {
  type BottleExactMetadataKey,
} from "./bottleExactMetadata";

type BottleIdentitySource = Pick<
  Bottle,
  | "id"
  | "fullName"
  | "name"
  | "group"
  | "brand"
  | "edition"
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

type RelativeIdentity = {
  label: string;
  excludeMetadata: BottleExactMetadataKey[];
  fallback?: boolean;
};

function formatAbv(abv: number) {
  return `${abv.toFixed(1)}% ABV`;
}

function getEditionMetadataDuplicates(
  bottle: BottleIdentitySource,
): BottleExactMetadataKey[] {
  const edition = bottle.edition?.toLocaleLowerCase();
  if (!edition) return [];

  const duplicates: BottleExactMetadataKey[] = [];
  if (
    bottle.vintageYear !== null &&
    edition.includes(String(bottle.vintageYear)) &&
    edition.includes("vintage")
  ) {
    duplicates.push("vintage");
  }
  if (
    bottle.releaseYear !== null &&
    edition.includes(String(bottle.releaseYear)) &&
    edition.includes("release")
  ) {
    duplicates.push("release");
  }
  if (bottle.singleCask && edition.includes("single cask")) {
    duplicates.push("single-cask");
  }
  if (bottle.caskStrength && edition.includes("cask strength")) {
    duplicates.push("cask-strength");
  }
  if (
    bottle.abv !== null &&
    edition.includes(bottle.abv.toFixed(1)) &&
    edition.includes("abv")
  ) {
    duplicates.push("abv");
  }
  return duplicates;
}

function getMetadataExpressedByTitle(
  bottle: BottleIdentitySource,
  title: string,
): BottleExactMetadataKey[] {
  const normalizedTitle = title.toLocaleLowerCase();
  const duplicates: BottleExactMetadataKey[] = [];

  if (
    bottle.statedAge !== null &&
    normalizedTitle.includes(String(bottle.statedAge)) &&
    normalizedTitle.includes("year")
  ) {
    duplicates.push("age");
  }
  if (
    bottle.abv !== null &&
    normalizedTitle.includes(bottle.abv.toFixed(1)) &&
    normalizedTitle.includes("abv")
  ) {
    duplicates.push("abv");
  }
  if (
    bottle.vintageYear !== null &&
    normalizedTitle.includes(String(bottle.vintageYear)) &&
    normalizedTitle.includes("vintage")
  ) {
    duplicates.push("vintage");
  }
  if (
    bottle.releaseYear !== null &&
    normalizedTitle.includes(String(bottle.releaseYear)) &&
    normalizedTitle.includes("release")
  ) {
    duplicates.push("release");
  }
  if (bottle.singleCask && normalizedTitle.includes("single cask")) {
    duplicates.push("single-cask");
  }
  if (bottle.caskStrength && normalizedTitle.includes("cask strength")) {
    duplicates.push("cask-strength");
  }
  return duplicates;
}

/**
 * Chooses only explicit Bottle-owned identity. Canonical names remain the
 * fallback because missing exact fields must not invent a release label.
 */
export function getRelativeBottleIdentity(
  bottle: BottleIdentitySource,
): RelativeIdentity {
  if (bottle.edition) {
    return {
      label: bottle.edition,
      excludeMetadata: getEditionMetadataDuplicates(bottle),
    };
  }
  if (bottle.vintageYear !== null) {
    return {
      label: `${bottle.vintageYear} vintage`,
      excludeMetadata: ["vintage"],
    };
  }
  if (bottle.releaseYear !== null) {
    return {
      label: `${bottle.releaseYear} release`,
      excludeMetadata: ["release"],
    };
  }
  if (
    bottle.statedAge !== null &&
    bottle.statedAge !== bottle.group?.statedAge
  ) {
    return {
      label: `${bottle.statedAge} years`,
      excludeMetadata: ["age"],
    };
  }
  if (bottle.singleCask) {
    return { label: "Single cask", excludeMetadata: ["single-cask"] };
  }
  if (bottle.caskStrength) {
    return { label: "Cask strength", excludeMetadata: ["cask-strength"] };
  }
  if (bottle.abv !== null) {
    return { label: formatAbv(bottle.abv), excludeMetadata: ["abv"] };
  }
  return { label: bottle.name, excludeMetadata: [], fallback: true };
}

function BottleIdentityLink({
  bottle,
  children,
  className,
  current,
}: {
  bottle: BottleIdentitySource;
  children: ReactNode;
  className?: string;
  current?: boolean;
}) {
  return (
    <Link
      href={`/bottles/${bottle.id}`}
      title={bottle.fullName}
      aria-current={current ? "page" : undefined}
      className={className}
    >
      {children}
    </Link>
  );
}

export default function BottleIdentity({
  bottle,
  mode,
  current = false,
}: {
  bottle: BottleIdentitySource;
  mode: "absolute" | "relative";
  current?: boolean;
}) {
  const relativeIdentity = getRelativeBottleIdentity(bottle);
  const isAbsolute = mode === "absolute";
  const title = isAbsolute
    ? (bottle.group?.name ?? bottle.name)
    : relativeIdentity.label;
  const leadingContent =
    isAbsolute && bottle.group && !relativeIdentity.fallback
      ? relativeIdentity.label
      : undefined;
  const titleMetadata = isAbsolute
    ? getMetadataExpressedByTitle(bottle, title)
    : [];

  return (
    <div className="min-w-0">
      {isAbsolute ? (
        <div className="text-muted truncate text-xs font-medium uppercase tracking-wide">
          {bottle.brand.name}
        </div>
      ) : null}
      <div className="flex min-w-0 flex-wrap items-center gap-x-2">
        <BottleIdentityLink
          bottle={bottle}
          current={current}
          className="break-words font-semibold hover:underline"
        >
          {title}
        </BottleIdentityLink>
        {current ? (
          <span
            className="h-2 w-2 shrink-0 rounded-full bg-orange-400"
            title="Currently viewing"
            aria-hidden="true"
          />
        ) : null}
      </div>
      <BottleExactMetadata
        bottle={bottle}
        exclude={[
          "category",
          ...titleMetadata,
          ...(!isAbsolute || leadingContent
            ? relativeIdentity.excludeMetadata
            : []),
        ]}
        leadingContent={leadingContent}
      />
    </div>
  );
}
