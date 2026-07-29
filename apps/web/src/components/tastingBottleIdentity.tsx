import { formatCategoryName } from "@peated/server/lib/format";
import type { Bottle } from "@peated/server/types";
import BottleStatusIcons from "@peated/web/components/bottleStatusIcons";
import Link from "@peated/web/components/link";
import classNames from "../lib/classNames";
import Join from "./join";
import SingleCaskChip from "./singleCaskChip";

export type TastingBottleIdentitySource = Pick<
  Bottle,
  | "id"
  | "fullName"
  | "edition"
  | "releaseYear"
  | "vintageYear"
  | "singleCask"
  | "category"
  | "statedAge"
  | "isLibrary"
  | "hasTasted"
> & {
  brand: Pick<Bottle["brand"], "name" | "shortName">;
  distillers: Pick<Bottle["distillers"][number], "id" | "name">[];
  group?: Pick<NonNullable<Bottle["group"]>, "name">;
};

function getExactBottleLabel(
  bottle: TastingBottleIdentitySource,
  displayName: string,
) {
  if (bottle.edition) {
    return `${bottle.edition}${bottle.releaseYear ? ` (${bottle.releaseYear})` : ""}${bottle.vintageYear ? ` (${bottle.vintageYear} Vintage)` : ""}`;
  }
  if (bottle.releaseYear) return `${bottle.releaseYear} Bottling`;
  if (bottle.vintageYear) return `${bottle.vintageYear} Vintage`;

  const prefix = `${displayName} - `;
  return bottle.fullName.startsWith(prefix)
    ? bottle.fullName.slice(prefix.length)
    : null;
}

export default function TastingBottleIdentity({
  bottle,
  variant = "panel",
}: {
  bottle: TastingBottleIdentitySource;
  variant?: "inline" | "panel";
}) {
  const displayName = bottle.group
    ? `${bottle.brand.shortName || bottle.brand.name} ${bottle.group.name}`
    : bottle.fullName;
  const exactBottleLabel = getExactBottleLabel(bottle, displayName);

  return (
    <div
      className={classNames(
        "flex items-center space-x-2 overflow-hidden sm:space-x-3 sm:rounded",
        variant === "panel" ? "bg-highlight p-4 text-black lg:p-5" : "",
      )}
    >
      <div className="flex-1 overflow-hidden">
        <div className="flex w-full items-center gap-x-1 font-bold">
          <div className="space-x-1">
            <h4 className="inline font-bold" title={bottle.fullName}>
              <Link href={`/bottles/${bottle.id}`} className="hover:underline">
                {displayName}
              </Link>
            </h4>
            <BottleStatusIcons bottle={bottle} className="inline h-4 w-4" />
            {!exactBottleLabel && bottle.singleCask && <SingleCaskChip />}
          </div>
        </div>
        <div
          className={classNames(
            "flex flex-row gap-x-1 text-sm",
            variant === "inline" ? "text-muted" : "",
          )}
        >
          {exactBottleLabel ? (
            <div className="flex flex-wrap items-center gap-2">
              <span>{exactBottleLabel}</span>
              {bottle.singleCask && <SingleCaskChip />}
            </div>
          ) : null}
          {!!(exactBottleLabel && bottle.distillers.length) && (
            <div>&middot;</div>
          )}
          {bottle.distillers.length ? (
            <Join divider=", ">
              {bottle.distillers.map((distiller) => (
                <Link
                  key={distiller.id}
                  href={`/entities/${distiller.id}`}
                  className="hover:underline"
                >
                  {distiller.name}
                </Link>
              ))}
            </Join>
          ) : null}
        </div>
      </div>
      <div
        className={classNames(
          variant === "inline" ? "text-muted" : "",
          "hidden w-[200px] flex-col items-end justify-center whitespace-nowrap text-sm sm:flex",
        )}
      >
        <div className="max-w-full truncate">
          {bottle.category ? (
            <Link
              href={`/bottles?category=${bottle.category}`}
              className="hover:underline"
            >
              {formatCategoryName(bottle.category)}
            </Link>
          ) : null}
        </div>
        <div>{bottle.statedAge ? `Aged ${bottle.statedAge} years` : null}</div>
      </div>
    </div>
  );
}
