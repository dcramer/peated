import type { Entity } from "@peated/server/types";
import EntityIcon from "@peated/web/assets/entity.svg";
import { Link } from "@tanstack/react-router";
import { getEntityTypeSearchUrl } from "../lib/urls";
import Chip from "./chip";
import PageHeader from "./pageHeader";

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
        <div className="max-w-full text-center text-muted lg:text-left">
          {!!entity.country && (
            <>
              Located in{" "}
              <Link
                to="/locations/$countrySlug"
                params={{ countrySlug: entity.country.slug }}
                className="truncate hover:underline"
              >
                {entity.country.name}
              </Link>
            </>
          )}
          {!!entity.country && !!entity.region && (
            <span>
              {" "}
              &middot;{" "}
              <Link
                to="/locations/$countrySlug/regions/$regionSlug"
                params={{
                  countrySlug: entity.country.slug,
                  regionSlug: entity.region.slug,
                }}
                className="truncate hover:underline"
              >
                {entity.region.name}
              </Link>
            </span>
          )}
        </div>
      }
      metadata={
        <div className="flex gap-x-1">
          {entity.type.sort().map((t) => (
            <Chip
              key={t}
              size="small"
              color="highlight"
              as={Link}
              to={`${getEntityTypeSearchUrl(t)}`}
            >
              {t}
            </Chip>
          ))}
        </div>
      }
    />
  );
}
