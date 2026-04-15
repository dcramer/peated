import BottleIcon from "@peated/web/assets/bottle.svg";
import Button from "@peated/web/components/button";
import CollectionAction from "@peated/web/components/collectionAction";
import DefinitionList from "@peated/web/components/definitionList";
import Heading from "@peated/web/components/heading";
import Link from "@peated/web/components/link";
import Markdown from "@peated/web/components/markdown";
import PageHeader from "@peated/web/components/pageHeader";
import SingleCaskChip from "@peated/web/components/singleCaskChip";
import {
  formatBottlingName,
  getBottleBottlingsPath,
} from "@peated/web/lib/bottlings";
import { getServerClient } from "@peated/web/lib/orpc/client.server";
import { resolveOrNotFound } from "@peated/web/lib/orpc/notFound.server";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense, type ReactNode } from "react";

function DetailValue({
  value,
  fallback = <em>n/a</em>,
}: {
  value: ReactNode;
  fallback?: ReactNode;
}) {
  return value === null || value === undefined || value === ""
    ? fallback
    : value;
}

export async function generateMetadata({
  params: { bottleId, bottlingId },
}: {
  params: { bottleId: string; bottlingId: string };
}): Promise<Metadata> {
  const { client } = await getServerClient();

  const [bottle, bottling] = await Promise.all([
    resolveOrNotFound(client.bottles.details({ bottle: Number(bottleId) })),
    resolveOrNotFound(
      client.bottleReleases.details({ release: Number(bottlingId) }),
    ),
  ]);

  return {
    title: bottling.fullName,
    description: `Specific bottling of ${bottle.fullName}.`,
  };
}

export default async function Page({
  params: { bottleId, bottlingId },
}: {
  params: { bottleId: string; bottlingId: string };
}) {
  const { client } = await getServerClient();

  const [bottle, bottling] = await Promise.all([
    resolveOrNotFound(client.bottles.details({ bottle: Number(bottleId) })),
    resolveOrNotFound(
      client.bottleReleases.details({ release: Number(bottlingId) }),
    ),
  ]);

  if (bottling.bottleId !== bottle.id) {
    notFound();
  }

  return (
    <div className="w-full p-3 lg:py-0">
      <PageHeader
        icon={BottleIcon}
        title={
          <div className="flex flex-wrap items-center justify-center gap-2 lg:justify-start">
            <span>{formatBottlingName(bottling) || bottling.fullName}</span>
            {bottling.singleCask && <SingleCaskChip />}
          </div>
        }
        titleExtra={
          <div className="text-muted flex flex-wrap items-center gap-x-2 gap-y-1">
            <span>Bottling of</span>
            <Link href={`/bottles/${bottle.id}`} className="hover:underline">
              {bottle.fullName}
            </Link>
          </div>
        }
      />

      <div className="my-8 flex flex-col justify-center gap-2 sm:flex-row lg:justify-start">
        <div className="flex flex-grow justify-center gap-4 gap-x-2 lg:justify-start">
          <Suspense fallback={null}>
            <CollectionAction bottleId={bottle.id} releaseId={bottling.id} />
          </Suspense>
          <Button
            href={`/bottles/${bottle.id}/addTasting?bottling=${bottling.id}`}
            color="primary"
          >
            Record a Tasting
          </Button>
          <Button href={getBottleBottlingsPath(bottle.id)}>
            All Bottlings
          </Button>
        </div>
      </div>

      <div className="my-6 space-y-6 px-3 md:px-0">
        {bottling.description && (
          <section>
            <Heading as="h3">Summary</Heading>
            <div className="prose prose-invert -mt-1 max-w-none">
              <Markdown content={bottling.description} />
            </div>
          </section>
        )}

        <section>
          <Heading as="h3">Details</Heading>
          <DefinitionList>
            <DefinitionList.Term>Parent Bottle</DefinitionList.Term>
            <DefinitionList.Details>
              <Link href={`/bottles/${bottle.id}`} className="underline">
                {bottle.fullName}
              </Link>
            </DefinitionList.Details>

            <DefinitionList.Term>Label</DefinitionList.Term>
            <DefinitionList.Details>
              <DetailValue value={bottling.edition} />
            </DefinitionList.Details>

            <DefinitionList.Term>Age</DefinitionList.Term>
            <DefinitionList.Details>
              <DetailValue
                value={
                  bottling.statedAge ? `${bottling.statedAge} years` : null
                }
              />
            </DefinitionList.Details>

            <DefinitionList.Term>ABV</DefinitionList.Term>
            <DefinitionList.Details>
              <DetailValue value={bottling.abv ? `${bottling.abv}%` : null} />
            </DefinitionList.Details>

            <DefinitionList.Term>Bottled</DefinitionList.Term>
            <DefinitionList.Details>
              <DetailValue value={bottling.releaseYear} />
            </DefinitionList.Details>

            <DefinitionList.Term>Vintage</DefinitionList.Term>
            <DefinitionList.Details>
              <DetailValue value={bottling.vintageYear} />
            </DefinitionList.Details>

            <DefinitionList.Term>Single Cask</DefinitionList.Term>
            <DefinitionList.Details>
              <DetailValue
                value={
                  bottling.singleCask === null
                    ? null
                    : bottling.singleCask
                      ? "yes"
                      : "no"
                }
              />
            </DefinitionList.Details>

            <DefinitionList.Term>Cask Strength</DefinitionList.Term>
            <DefinitionList.Details>
              <DetailValue
                value={
                  bottling.caskStrength === null
                    ? null
                    : bottling.caskStrength
                      ? "yes"
                      : "no"
                }
              />
            </DefinitionList.Details>

            <DefinitionList.Term>Cask Type</DefinitionList.Term>
            <DefinitionList.Details>
              <DetailValue value={bottling.caskType} />
            </DefinitionList.Details>

            <DefinitionList.Term>Cask Fill</DefinitionList.Term>
            <DefinitionList.Details>
              <DetailValue value={bottling.caskFill} />
            </DefinitionList.Details>

            <DefinitionList.Term>Cask Size</DefinitionList.Term>
            <DefinitionList.Details>
              <DetailValue value={bottling.caskSize} />
            </DefinitionList.Details>
          </DefinitionList>
        </section>

        {bottling.tastingNotes && (
          <section>
            <Heading as="h3">Tasting Notes</Heading>
            <DefinitionList>
              <DefinitionList.Term>Nose</DefinitionList.Term>
              <DefinitionList.Details>
                {bottling.tastingNotes.nose}
              </DefinitionList.Details>
              <DefinitionList.Term>Palate</DefinitionList.Term>
              <DefinitionList.Details>
                {bottling.tastingNotes.palate}
              </DefinitionList.Details>
              <DefinitionList.Term>Finish</DefinitionList.Term>
              <DefinitionList.Details>
                {bottling.tastingNotes.finish}
              </DefinitionList.Details>
            </DefinitionList>
          </section>
        )}
      </div>
    </div>
  );
}
