import type { Bottle } from "@peated/server/types";
import BottleIcon from "@peated/web/assets/bottle.svg";
import BottleExactMetadata, {
  hasBottleExactMetadata,
} from "@peated/web/components/bottleExactMetadata";
import {
  getAbsoluteBottleLabel,
  getAbsoluteBottleTitle,
  getBottleIdentitySeriesName,
  getBottleMetadataExclusions,
  getDistinctBottleDistillers,
  type BottleIdentitySource,
} from "@peated/web/components/bottleIdentity";
import Link from "@peated/web/components/link";
import type { ElementType } from "react";
import { Distillers } from "./bottleMetadata";
import PageHeader from "./pageHeader";

export type BottleHeaderBottle = BottleIdentitySource & {
  distillers: Array<Pick<Bottle["distillers"][number], "id" | "name">>;
};

export default function BottleHeader({
  bottle,
  href,
  compact,
  icon = BottleIcon,
}: {
  bottle: BottleHeaderBottle;
  href?: string;
  compact?: boolean;
  icon?: ElementType;
}) {
  const label = getAbsoluteBottleLabel(bottle);
  const expressionName = getAbsoluteBottleTitle(bottle);
  const metadataExclude = getBottleMetadataExclusions(bottle, expressionName);
  const distinctDistillers = getDistinctBottleDistillers(bottle);
  const seriesName = getBottleIdentitySeriesName(bottle, expressionName);

  if (
    bottle.edition &&
    expressionName
      .toLocaleLowerCase()
      .includes(bottle.edition.toLocaleLowerCase())
  ) {
    metadataExclude.add("edition");
  }
  const metadataKeys = [...metadataExclude];
  const hasIdentityDetails =
    hasBottleExactMetadata(bottle, metadataKeys) ||
    distinctDistillers.length > 0;

  return (
    <PageHeader
      icon={icon}
      compact={compact}
      title={
        <div className="flex flex-wrap items-center gap-2">
          {href ? (
            <Link
              href={href}
              title={bottle.fullName}
              className="hover:underline"
            >
              {label}
            </Link>
          ) : (
            <div title={bottle.fullName} className="flex min-w-0 flex-col">
              <span className="text-muted flex min-w-0 items-center justify-center gap-1.5 truncate text-xs font-medium uppercase tracking-wide lg:justify-start">
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
              </span>
              <span>{expressionName}</span>
            </div>
          )}
        </div>
      }
      titleExtra={
        hasIdentityDetails ? (
          <div className="flex max-w-full flex-col items-center lg:items-start">
            <BottleExactMetadata
              bottle={bottle}
              exclude={metadataKeys}
              className="justify-center lg:justify-start"
            />
            {distinctDistillers.length ? (
              <div className="text-muted mt-1 text-sm">
                <Distillers
                  distillers={distinctDistillers}
                  isBlend={bottle.category === "blend"}
                />
              </div>
            ) : null}
          </div>
        ) : null
      }
    />
  );
}
