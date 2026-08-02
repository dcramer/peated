import { toTitleCase } from "@peated/server/lib/strings";
import type { Bottle } from "@peated/server/types";
import Link from "@peated/web/components/link";
import {
  getBottleContextLabel,
  getBottleExpressionName,
} from "@peated/web/lib/bottleLabel";
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
  brand: Pick<Bottle["brand"], "id" | "name" | "shortName">;
  series: Pick<NonNullable<Bottle["series"]>, "id" | "name"> | null;
  group?: Pick<NonNullable<Bottle["group"]>, "name" | "statedAge">;
};

export function BottleLabel({
  bottle,
  className,
}: {
  bottle: BottleIdentitySource;
  className?: string;
}) {
  return (
    <span title={bottle.fullName} className={className}>
      {getAbsoluteBottleLabel(bottle)}
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

/**
 * Removes only canonical trailing metadata from an ungrouped Bottle name.
 * A metadata-only name remains intact so identities such as "21-year-old"
 * still have a useful headline.
 */
export function getAbsoluteBottleTitle(bottle: BottleIdentitySource) {
  return getBottleExpressionName(bottle);
}

export function getAbsoluteBottleLabel(bottle: BottleIdentitySource) {
  return getBottleContextLabel({
    ...bottle,
    name: getAbsoluteBottleTitle(bottle),
    group: undefined,
  });
}

export function getBottleIdentitySeriesName(
  bottle: Pick<BottleIdentitySource, "series">,
  displayedIdentity: string,
) {
  if (
    !bottle.series ||
    displayedIdentity
      .toLocaleLowerCase()
      .includes(bottle.series.name.toLocaleLowerCase())
  ) {
    return null;
  }

  return bottle.series.name;
}

export function getDistinctBottleDistillers({
  brand,
  distillers,
}: {
  brand: Pick<Bottle["brand"], "name" | "shortName">;
  distillers: Pick<Bottle["distillers"][number], "id" | "name">[];
}) {
  const brandNames = new Set(
    [brand.name, brand.shortName]
      .filter((name): name is string => Boolean(name))
      .map((name) => name.toLocaleLowerCase()),
  );

  return distillers.filter(
    (distiller) => !brandNames.has(distiller.name.toLocaleLowerCase()),
  );
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

export function getMetadataExpressedByTitle(
  bottle: Pick<
    BottleIdentitySource,
    | "edition"
    | "statedAge"
    | "abv"
    | "vintageYear"
    | "releaseYear"
    | "singleCask"
    | "caskStrength"
    | "caskFill"
    | "caskType"
    | "caskSize"
  >,
  title: string,
): BottleExactMetadataKey[] {
  const normalizedTitle = title.toLocaleLowerCase();
  const duplicates: BottleExactMetadataKey[] = [];

  if (
    bottle.edition &&
    normalizedTitle.includes(bottle.edition.toLocaleLowerCase())
  ) {
    duplicates.push("edition");
  }

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
  const caskDetails = [
    bottle.caskFill,
    bottle.caskType,
    bottle.caskSize,
  ].filter((value): value is NonNullable<typeof value> => value !== null);
  if (
    caskDetails.length > 0 &&
    caskDetails.every((value) =>
      normalizedTitle.includes(toTitleCase(value).toLocaleLowerCase()),
    )
  ) {
    duplicates.push("cask-details");
  }
  return duplicates;
}

export function getBottleMetadataExclusions(
  bottle: Parameters<typeof getMetadataExpressedByTitle>[0],
  displayedIdentity: string,
) {
  const exclusions = new Set(
    getMetadataExpressedByTitle(bottle, displayedIdentity),
  );

  exclusions.add("single-cask");
  exclusions.add("cask-strength");
  exclusions.add("cask-details");

  if (bottle.edition) {
    exclusions.add("vintage");
    exclusions.add("release");
  } else if (bottle.vintageYear !== null && bottle.releaseYear !== null) {
    exclusions.add("release");
  }

  return exclusions;
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
  showBrand = true,
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
  showBrand?: boolean;
}) {
  const relativeIdentity = getRelativeBottleIdentity(bottle);
  const isAbsolute = mode === "absolute";
  const title = isAbsolute
    ? getAbsoluteBottleTitle(bottle)
    : relativeIdentity.label;
  const titleMetadata = getBottleMetadataExclusions(bottle, title);
  const leadingContent =
    isAbsolute &&
    bottle.group &&
    !relativeIdentity.fallback &&
    !relativeIdentity.excludeMetadata.some((key) => titleMetadata.has(key))
      ? relativeIdentity.label
      : undefined;
  const displayedLeadingContent =
    metadataVariant === "summary" ? undefined : leadingContent;
  const metadataExclude = titleMetadata;
  if (!isAbsolute || displayedLeadingContent) {
    relativeIdentity.excludeMetadata.forEach((key) => metadataExclude.add(key));
  }
  if (
    !isAbsolute &&
    bottle.group &&
    bottle.statedAge === bottle.group.statedAge
  ) {
    metadataExclude.add("age");
  }
  metadataExclude.add("category");
  const seriesName = isAbsolute
    ? getBottleIdentitySeriesName(bottle, title)
    : null;

  return (
    <div className={classNames("min-w-0", className)}>
      {isAbsolute && showBrand ? (
        <div className="text-muted flex min-w-0 items-center gap-1.5 truncate text-xs font-medium uppercase tracking-wide">
          <Link
            href={`/entities/${bottle.brand.id}`}
            className="truncate hover:underline"
          >
            {bottle.brand.shortName || bottle.brand.name}
          </Link>
          {seriesName ? (
            <>
              <span aria-hidden="true">&middot;</span>
              <Link
                href={`/bottles?series=${bottle.series!.id}`}
                className="truncate hover:underline"
              >
                {seriesName}
              </Link>
            </>
          ) : null}
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
        exclude={[...metadataExclude]}
        leadingContent={displayedLeadingContent}
      />
    </div>
  );
}
