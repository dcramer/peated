"use client";

import RobotImage from "@peated/web/assets/robot.png";
import Link from "@peated/web/components/link";
import { Suspense } from "react";
import type { RouterOutputs } from "../lib/trpc/client";
import BottleReviews from "./bottleReviews";
import BottleTagDistribution from "./bottleTagDistribution";
import CaskDetails from "./caskDetails";
import DefinitionList from "./definitionList";
import Heading from "./heading";
import Markdown from "./markdown";
import TimeSince from "./timeSince";
import UserAvatar from "./userAvatar";

export default function BottleOverview({
  bottle: { createdBy, ...bottle },
}: {
  bottle: RouterOutputs["bottleById"];
}) {
  return (
    <>
      <div className="my-6 px-3 md:px-0">
        <div className="flex space-x-4">
          <div className="flex-1">
            <Suspense>
              <BottleReviews bottleId={bottle.id} />
            </Suspense>
            {bottle.description && (
              <>
                <Heading as="h3">Summary</Heading>
                <div className="prose prose-invert -mt-1 max-w-none flex-auto">
                  <Markdown content={bottle.description} />
                </div>
              </>
            )}
            <div className="my-6 hidden px-3 md:px-0 lg:block">
              <BottleTagDistribution bottleId={bottle.id} />
            </div>
            {bottle.tastingNotes && (
              <>
                <Heading as="h3">Tasting Notes</Heading>
                <DefinitionList>
                  <DefinitionList.Term>Nose</DefinitionList.Term>
                  <DefinitionList.Details>
                    {bottle.tastingNotes.nose}
                  </DefinitionList.Details>
                  <DefinitionList.Term>Palate</DefinitionList.Term>
                  <DefinitionList.Details>
                    {bottle.tastingNotes.palate}
                  </DefinitionList.Details>
                  <DefinitionList.Term>Finish</DefinitionList.Term>
                  <DefinitionList.Details>
                    {bottle.tastingNotes.finish}
                  </DefinitionList.Details>
                </DefinitionList>
              </>
            )}
            <Heading as="h3">Additional Details</Heading>
            <DefinitionList>
              <DefinitionList.Term>Brand</DefinitionList.Term>
              <DefinitionList.Details>
                <Link
                  key={bottle.brand.id}
                  href={`/entities/${bottle.brand.id}`}
                  className="underline"
                >
                  {bottle.brand.name}
                </Link>
              </DefinitionList.Details>{" "}
              <DefinitionList.Term>Distilled At</DefinitionList.Term>
              <DefinitionList.Details>
                {bottle.distillers && bottle.distillers.length > 0 ? (
                  <div className="flex space-x-2">
                    {bottle.distillers.map((d) => (
                      <Link
                        key={d.id}
                        href={`/entities/${d.id}`}
                        className="underline"
                      >
                        {d.name}
                      </Link>
                    ))}
                  </div>
                ) : (
                  <em>unknown</em>
                )}
              </DefinitionList.Details>
              <DefinitionList.Term>Bottled By</DefinitionList.Term>
              <DefinitionList.Details>
                {bottle.bottler ? (
                  <Link
                    key={bottle.bottler.id}
                    href={`/entities/${bottle.bottler.id}`}
                    className="underline"
                  >
                    {bottle.bottler.name}
                  </Link>
                ) : (
                  <em>unknown</em>
                )}
              </DefinitionList.Details>
              <DefinitionList.Term>Cask Strength?</DefinitionList.Term>
              <DefinitionList.Details>
                <YesNo value={bottle.caskStrength} />
              </DefinitionList.Details>
              <DefinitionList.Term>Single Cask?</DefinitionList.Term>
              <DefinitionList.Details>
                <YesNo value={bottle.singleCask} />
              </DefinitionList.Details>
              <DefinitionList.Term>Cask Details</DefinitionList.Term>
              <DefinitionList.Details>
                {bottle.caskFill || bottle.caskSize || bottle.caskType ? (
                  <CaskDetails
                    caskFill={bottle.caskFill}
                    caskSize={bottle.caskSize}
                    caskType={bottle.caskType}
                  />
                ) : (
                  <em>unknown</em>
                )}
              </DefinitionList.Details>
              {!!bottle.vintageYear && (
                <>
                  <DefinitionList.Term>Vintage Year</DefinitionList.Term>
                  <DefinitionList.Details>
                    {bottle.vintageYear}
                  </DefinitionList.Details>
                </>
              )}
              {!!bottle.releaseYear && (
                <>
                  <DefinitionList.Term>Release Year</DefinitionList.Term>
                  <DefinitionList.Details>
                    {bottle.releaseYear}
                  </DefinitionList.Details>
                </>
              )}
              <>
                <DefinitionList.Term>Added By</DefinitionList.Term>
                <DefinitionList.Details>
                  {createdBy ? (
                    <>
                      <Link
                        href={`/users/${createdBy.username}`}
                        className="flex items-center gap-x-2 truncate hover:underline"
                      >
                        <UserAvatar size={16} user={createdBy} />
                        {createdBy.username}
                      </Link>
                      {bottle.createdAt && (
                        <TimeSince date={bottle.createdAt} />
                      )}
                    </>
                  ) : (
                    <em>unknown</em>
                  )}
                </DefinitionList.Details>
              </>
            </DefinitionList>
          </div>
          <div className="hidden w-64 lg:block">
            {bottle.imageUrl ? (
              <div className="rounded border border-slate-900 bg-slate-900 p-2">
                <img
                  src={bottle.imageUrl}
                  className="block w-64 rounded"
                  aria-hidden="true"
                />
              </div>
            ) : (
              <img
                src={RobotImage.src}
                className="block h-64 w-64"
                alt="peated robot"
                aria-hidden="true"
              />
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function YesNo({ value }: { value: boolean | null | undefined }) {
  if (value) return "Yes";
  if (value === false) return "No";
  return <em>n/a</em>;
}
