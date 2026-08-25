import type { Bottle } from "@peated/server/types";
import {
  type BottleIdentitySource,
  getAbsoluteBottleLabel,
  getBottleMetadataExclusions,
  getDistinctBottleDistillers,
  getRelativeBottleIdentity,
} from "@peated/web/components/bottleIdentity";
import BottleStatusIcons from "@peated/web/components/bottleStatusIcons";
import Link from "@peated/web/components/link";
import { getBottlePlainTextIdentity } from "@peated/web/lib/bottleLabel";
import Join from "./join";

export type TastingBottleIdentitySource = BottleIdentitySource &
  Pick<Bottle, "isLibrary" | "hasTasted"> & {
    distillers: Pick<Bottle["distillers"][number], "id" | "name">[];
  };

export default function TastingBottleIdentity({
  bottle,
  variant = "panel",
}: {
  bottle: TastingBottleIdentitySource;
  variant?: "inline" | "panel";
}) {
  const displayName = getAbsoluteBottleLabel(bottle);
  const relativeIdentity = getRelativeBottleIdentity(bottle);
  const exactBottleLabel =
    bottle.group && !relativeIdentity.fallback ? relativeIdentity.label : null;
  const distinctDistillers = getDistinctBottleDistillers(bottle);
  const inlineDisplayName = getBottlePlainTextIdentity(bottle);
  const metadataExclude = getBottleMetadataExclusions(
    bottle,
    `${displayName} ${exactBottleLabel ?? ""}`,
  );
  const standaloneAge = metadataExclude.has("age")
    ? null
    : bottle.statedAge === null
      ? "No age statement"
      : `Aged ${bottle.statedAge} years`;

  if (variant === "inline") {
    return (
      <div className="flex items-center space-x-2 overflow-hidden sm:space-x-3 sm:rounded">
        <div className="flex-1 overflow-hidden">
          <div className="flex w-full items-center gap-x-1 font-bold">
            <div className="space-x-1">
              <h4 className="inline font-bold" title={bottle.fullName}>
                <Link
                  href={`/bottles/${bottle.id}`}
                  className="hover:underline"
                >
                  {inlineDisplayName}
                </Link>
              </h4>
              <BottleStatusIcons bottle={bottle} className="inline h-4 w-4" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-highlight flex items-center space-x-2 overflow-hidden p-4 text-black sm:space-x-3 sm:rounded lg:p-5">
      <div className="flex-1 overflow-hidden">
        <div className="flex w-full items-center gap-x-1 font-bold">
          <div className="space-x-1">
            <h4 className="inline font-bold" title={bottle.fullName}>
              <Link href={`/bottles/${bottle.id}`} className="hover:underline">
                {displayName}
              </Link>
            </h4>
            <BottleStatusIcons bottle={bottle} className="inline h-4 w-4" />
          </div>
        </div>
        <div className="flex flex-row gap-x-1 text-sm">
          {exactBottleLabel ? <span>{exactBottleLabel}</span> : null}
          {!!(exactBottleLabel && distinctDistillers.length) && (
            <div>&middot;</div>
          )}
          {distinctDistillers.length ? (
            <Join divider=", ">
              {distinctDistillers.map((distiller) => (
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
      {standaloneAge ? (
        <div className="hidden w-[200px] flex-col items-end justify-center whitespace-nowrap text-sm sm:flex">
          <div>{standaloneAge}</div>
        </div>
      ) : null}
    </div>
  );
}
