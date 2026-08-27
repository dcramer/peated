import type { Entity } from "@peated/server/types";
import EntityIcon from "@peated/web/assets/entity.svg";
import Link from "@peated/web/components/link";
import { getEntityKindSearchUrl, getEntityUrl } from "../lib/urls";
import Chip from "./chip";
import PageHeader from "./pageHeader";
import PeatedId from "./peatedId";

export default function EntityHeader({
  entity,
  to,
}: {
  entity: Entity;
  to?: string;
}) {
  return (
    <PageHeader
      icon={EntityIcon}
      title={entity.name}
      titleExtra={
        <div className="flex max-w-full flex-col items-center lg:items-start">
          <PeatedId value={entity.peatedId} href={getEntityUrl(entity)} />
          <div className="text-muted max-w-full text-center lg:text-left">
            {!!entity.owner && (
              <div>
                Owned by{" "}
                <Link
                  href={`/entities/${entity.owner.id}`}
                  className="truncate hover:underline"
                >
                  {entity.owner.name}
                </Link>
              </div>
            )}
            {!!entity.country && (
              <div>
                Located in{" "}
                <Link
                  href={`/locations/${entity.country.slug}`}
                  className="truncate hover:underline"
                >
                  {entity.country.name}
                </Link>
                {!!entity.region && (
                  <>
                    {" "}
                    &middot;{" "}
                    <Link
                      href={`/locations/${entity.country.slug}/regions/${entity.region.slug}`}
                      className="truncate hover:underline"
                    >
                      {entity.region.name}
                    </Link>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      }
      metadata={
        <div className="flex gap-x-1">
          <Chip
            size="small"
            color="highlight"
            as={Link}
            href={getEntityKindSearchUrl(entity.kind)}
          >
            {entity.kind}
          </Chip>
        </div>
      }
    />
  );
}
