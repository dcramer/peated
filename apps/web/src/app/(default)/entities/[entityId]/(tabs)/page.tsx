"use client";

import { MapIcon } from "@heroicons/react/24/outline";
import RobotImage from "@peated/web/assets/robot.png";
import EntityMap from "@peated/web/components/entityMap";
import Link from "@peated/web/components/link";
import Markdown from "@peated/web/components/markdown";
import { useORPC } from "@peated/web/lib/orpc/context";
import { parseDomain } from "@peated/web/lib/urls";
import { useSuspenseQuery } from "@tanstack/react-query";

export default function EntityDetails({
  params: { entityId },
}: {
  params: { entityId: string };
}) {
  const orpc = useORPC();
  const { data: entity } = useSuspenseQuery(
    orpc.entities.details.queryOptions({
      input: {
        entity: Number(entityId),
      },
    })
  );

  return (
    <>
      <div className="my-6 px-3 md:px-0">
        {entity.description && (
          <div className="flex space-x-4">
            <div className="prose prose-invert -mt-5 max-w-none flex-auto">
              <Markdown content={entity.description} />
            </div>

            <img
              src={RobotImage.src}
              className="hidden h-40 w-40 sm:block"
              alt="robot image"
              aria-hidden="true"
            />
          </div>
        )}

        <div className="prose prose-invert max-w-none flex-auto">
          <dl>
            <dt>Website</dt>
            <dd>
              {entity.website ? (
                <a href={entity.website} className="hover:underline">
                  {parseDomain(entity.website)}
                </a>
              ) : (
                <em>n/a</em>
              )}
            </dd>
            <dt>Year Established</dt>
            <dd>{entity.yearEstablished ?? <em>n/a</em>}</dd>
            {!!entity.shortName && (
              <>
                <dt>Abbreviated As</dt>
                <dd>{entity.shortName}</dd>
              </>
            )}
            <dt>Location</dt>
            <dd className="flex flex-col space-y-2">
              <div>
                {entity.address ? (
                  <div className="flex flex-row items-center gap-x-2">
                    {entity.address}
                    <Link
                      href={`http://maps.google.com/?q=${encodeURIComponent(`${entity.name}, ${entity.address}`)}`}
                      target="_blank"
                      className="text-highlight"
                    >
                      <MapIcon className="h-4 w-4" />
                    </Link>
                  </div>
                ) : null}
                <div>
                  {entity.region && entity.country ? (
                    <>
                      <Link
                        href={`/locations/${entity.country.slug}/regions/${entity.region.slug}`}
                      >
                        {entity.region.name}
                      </Link>
                      <span>, </span>
                      <Link href={`/locations/${entity.country.slug}`}>
                        {entity.country.name}
                      </Link>
                    </>
                  ) : entity.country ? (
                    <Link href={`/locations/${entity.country.slug}`}>
                      {entity.country.name}
                    </Link>
                  ) : (
                    <em>n/a</em>
                  )}
                </div>
              </div>
              <EntityMap entity={entity} />
            </dd>
          </dl>
        </div>
      </div>
    </>
  );
}
