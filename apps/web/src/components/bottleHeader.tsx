import type { Bottle } from "@peated/server/types";
import BottleIcon from "@peated/web/assets/bottle.svg";
import BottleExactMetadata, {
  hasBottleExactMetadata,
} from "@peated/web/components/bottleExactMetadata";
import {
  getAbsoluteBottleLabel,
  getAbsoluteBottleTitle,
  getBottleMetadataExclusions,
  getDistinctBottleDistillers,
} from "@peated/web/components/bottleIdentity";
import Link from "@peated/web/components/link";
import { Distillers } from "./bottleMetadata";
import PageHeader from "./pageHeader";
import SingleCaskChip from "./singleCaskChip";

export default function BottleHeader({
  bottle,
  href,
  compact,
}: {
  bottle: Bottle;
  href?: string;
  compact?: boolean;
}) {
  const label = getAbsoluteBottleLabel(bottle);
  const expressionName = getAbsoluteBottleTitle(bottle);
  const metadataExclude = getBottleMetadataExclusions(bottle, expressionName);
  const distinctDistillers = getDistinctBottleDistillers(bottle);
  const showSingleCaskChip =
    bottle.singleCask && !metadataExclude.has("single-cask");

  if (showSingleCaskChip) metadataExclude.add("single-cask");
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
    showSingleCaskChip ||
    hasBottleExactMetadata(bottle, metadataKeys) ||
    distinctDistillers.length > 0;

  return (
    <PageHeader
      icon={BottleIcon}
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
            <div
              title={bottle.fullName}
              className="flex flex-wrap items-center gap-2"
            >
              <Link
                href={`/entities/${bottle.brand.id}`}
                className="hover:underline"
              >
                {bottle.brand.shortName || bottle.brand.name}
              </Link>
              {expressionName}
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
              leadingContent={
                showSingleCaskChip ? <SingleCaskChip /> : undefined
              }
              className="justify-center lg:justify-start"
            />
            {distinctDistillers.length ? (
              <div className="text-muted mt-1 text-sm">
                <Distillers distillers={distinctDistillers} />
              </div>
            ) : null}
          </div>
        ) : null
      }
    />
  );
}
