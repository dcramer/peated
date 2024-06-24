import { MapIcon } from "@heroicons/react/24/outline";
import RobotImage from "@peated/web/assets/robot.png";
import EntityMap from "@peated/web/components/entityMap";
import EntitySpiritDistribution from "@peated/web/components/entitySpiritDistribution";
import Markdown from "@peated/web/components/markdown";
import { summarize } from "@peated/web/lib/markdown";
import { getTrpcClient } from "@peated/web/lib/trpc.server";
import { parseDomain } from "@peated/web/lib/urls";
import Link from "next/link";
import { Suspense } from "react";

export async function generateMetadata({
  params: { entityId },
}: {
  params: { entityId: string };
}) {
  const trpcClient = await getTrpcClient();
  const entity = await trpcClient.entityById.ensureData(Number(entityId));

  const description = summarize(entity.description || "", 200);

  return {
    title: entity.name,
    description,
    openGraph: {
      title: entity.name,
      description: description,
    },
    twitter: {
      card: "product",
    },
  };
}

export default async function EntityDetails({
  params: { entityId },
}: {
  params: { entityId: string };
}) {
  const trpcClient = await getTrpcClient();
  const entity = await trpcClient.entityById.ensureData(Number(entityId));

  return (
    <>
      <div className="my-6 flex flex-col gap-4 px-3 sm:flex-row md:px-0">
        <div className="flex-auto">
          <Suspense
            fallback={
              <div
                className="animate-pulse rounded bg-slate-800"
                style={{ height: 20 }}
              />
            }
          >
            <EntitySpiritDistribution entityId={entity.id} />
          </Suspense>
        </div>
      </div>

      <div className="my-6 px-3 md:px-0">
        {entity.description && (
          <div className="flex space-x-4">
            <div className="prose prose-invert -mt-5 max-w-none flex-auto">
              <Markdown content={entity.description} />
            </div>

            <img src={RobotImage.src} className="hidden h-40 w-40 sm:block" />
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
                      <Link href={`/entities?region=${entity.region}`}>
                        {entity.region}
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
