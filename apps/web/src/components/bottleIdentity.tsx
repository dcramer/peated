import { toTitleCase } from "@peated/server/lib/strings";
import type { Bottle } from "@peated/server/types";
import Link from "@peated/web/components/link";
import { getBottleLabel } from "@peated/web/lib/bottleLabel";
import classNames from "@peated/web/lib/classNames";
import type { MouseEventHandler, ReactNode } from "react";
import BottleExactMetadata, {
  type BottleExactMetadataKey,
} from "./bottleExactMetadata";

export type BottleIdentitySource = Pick<
  Bottle,
  | "id"
  | "fullName"
  | "name"
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
> & {
  brand: Pick<Bottle["brand"], "name" | "shortName">;
  group?: Pick<NonNullable<Bottle["group"]>, "name" | "statedAge">;
};

export function BottleLabel({
  bottle,
  className,
}: {
  bottle: Pick<BottleIdentitySource, "fullName" | "name" | "brand" | "group">;
  className?: string;
}) {
  return (
    <span title={bottle.fullName} className={className}>
      {getBottleLabel(bottle)}
    </span>
  );
}

type RelativeIdentity = {
  label: string;
  excludeMetadata: BottleExactMetadataKey[];
  fallback?: boolean;
};

function formatAbv(abv: number) {
  return `${abv.toFixed(1)}% ABV`;
}

function getCanonicalMetadataSegments(bottle: BottleIdentitySource) {
  return new Set(
    [
      bottle.statedAge !== null ? `${bottle.statedAge}-year-old` : undefined,
      bottle.releaseYear !== null ? `${bottle.releaseYear} Release` : undefined,
      bottle.vintageYear !== null ? `${bottle.vintageYear} Vintage` : undefined,
      bottle.abv !== null ? formatAbv(bottle.abv) : undefined,
      bottle.singleCask ? "Single Cask" : undefined,
      bottle.caskStrength ? "Cask Strength" : undefined,
      bottle.caskType ? `${toTitleCase(bottle.caskType)} Cask` : undefined,
      bottle.caskSize ? toTitleCase(bottle.caskSize) : undefined,
      bottle.caskFill
        ? bottle.caskFill === "other"
          ? "Other Fill"
          : toTitleCase(bottle.caskFill)
        : undefined,
    ]
      .filter((value): value is string => value !== undefined)
      .map((value) => value.toLocaleLowerCase()),
  );
}

/**
 * Removes only canonical trailing metadata from an ungrouped Bottle name.
 * A metadata-only name remains intact so identities such as "21-year-old"
 * still have a useful headline.
 */
export function getAbsoluteBottleTitle(bottle: BottleIdentitySource) {
  if (bottle.group) return bottle.group.name;

  const metadataSegments = getCanonicalMetadataSegments(bottle);
  const titleSegments = bottle.name.split(" - ");

  while (
    titleSegments.length &&
    metadataSegments.has(
      titleSegments[titleSegments.length - 1]!.toLocaleLowerCase(),
    )
  ) {
    titleSegments.pop();
  }

  return titleSegments.length ? titleSegments.join(" - ") : bottle.name;
}

function getEditionMetadataDuplicates(
  bottle: BottleIdentitySource,
): BottleExactMetadataKey[] {
  const edition = bottle.edition?.toLocaleLowerCase();
  if (!edition) return [];

  const duplicates: BottleExactMetadataKey[] = ["edition"];
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
  onClick,
  href,
}: {
  bottle: BottleIdentitySource;
  children: ReactNode;
  className?: string;
  current?: boolean;
  onClick?: MouseEventHandler<HTMLAnchorElement>;
  href?: string;
}) {
  return (
    <Link
      href={href ?? `/bottles/${bottle.id}`}
      title={bottle.fullName}
      aria-current={current ? "page" : undefined}
      className={className}
      onClick={onClick}
    >
      {children}
    </Link>
  );
}

export default function BottleIdentity({
  bottle,
  mode = "absolute",
  current = false,
  metadataVariant = "full",
  onClick,
  trailingContent,
  href,
  className,
  linkClassName,
}: {
  bottle: BottleIdentitySource;
  mode?: "absolute" | "relative";
  current?: boolean;
  metadataVariant?: "full" | "summary";
  onClick?: MouseEventHandler<HTMLAnchorElement>;
  trailingContent?: ReactNode;
  href?: string;
  className?: string;
  linkClassName?: string;
}) {
  const relativeIdentity = getRelativeBottleIdentity(bottle);
  const isAbsolute = mode === "absolute";
  const title = isAbsolute
    ? getAbsoluteBottleTitle(bottle)
    : relativeIdentity.label;
  const leadingContent =
    isAbsolute && bottle.group && !relativeIdentity.fallback
      ? relativeIdentity.label
      : undefined;
  const displayedLeadingContent =
    metadataVariant === "summary" ? undefined : leadingContent;
  const titleMetadata = isAbsolute
    ? getMetadataExpressedByTitle(bottle, title)
    : [];

  return (
    <div className={classNames("min-w-0", className)}>
      {isAbsolute ? (
        <div className="text-muted truncate text-xs font-medium uppercase tracking-wide">
          {bottle.brand.name}
        </div>
      ) : null}
      <div className="flex min-w-0 flex-wrap items-center gap-x-2">
        <BottleIdentityLink
          bottle={bottle}
          current={current}
          onClick={onClick}
          href={href}
          className={classNames(
            "break-words font-semibold hover:underline",
            linkClassName,
          )}
        >
          {title}
        </BottleIdentityLink>
        {trailingContent}
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
        variant={metadataVariant}
        exclude={[
          "category",
          ...titleMetadata,
          ...(!isAbsolute || displayedLeadingContent
            ? relativeIdentity.excludeMetadata
            : []),
        ]}
        leadingContent={displayedLeadingContent}
      />
    </div>
  );
}
