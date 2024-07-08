"use client";

import type { Bottle } from "@peated/server/types";
import RobotImage from "@peated/web/assets/robot.png";
import Link from "@peated/web/components/link";
import { Suspense } from "react";
import BottleReviews from "./bottleReviews";
import BottleTagDistribution, {
  BottleTagDistributionSkeleton,
} from "./bottleTagDistribution";
import CaskDetails from "./caskDetails";
import DefinitionList from "./definitionList";
import Heading from "./heading";
import Markdown from "./markdown";
import TimeSince from "./timeSince";

export default function BottleOverview({ bottle }: { bottle: Bottle }) {
  return (
    <>
      <div className="my-6 px-3 md:px-0">
        <Suspense fallback={<BottleTagDistributionSkeleton />}>
          <BottleTagDistribution bottleId={bottle.id} />
        </Suspense>
      </div>

      <div className="my-6 px-3 md:px-0">
        <div className="flex space-x-4">
          <div className="max-w-none flex-auto">
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
                {bottle.distillers.length > 0 ? (
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
              <DefinitionList.Term>Cask Details</DefinitionList.Term>
              <DefinitionList.Details>
                <CaskDetails
                  caskFill={bottle.caskFill}
                  caskSize={bottle.caskSize}
                  caskType={bottle.caskType}
                />
              </DefinitionList.Details>
              {!!bottle.vintageYear && (
                <>
                  <DefinitionList.Term>Vintage Year</DefinitionList.Term>
                  <DefinitionList.Details>
                    {bottle.vintageYear}
                  </DefinitionList.Details>
                </>
              )}
              {!!bottle.releaseDate && (
                <>
                  <DefinitionList.Term>Release Date</DefinitionList.Term>
                  <DefinitionList.Details>
                    {bottle.releaseDate}
                  </DefinitionList.Details>
                </>
              )}
            </DefinitionList>
          </div>
          <img
            src={RobotImage.src}
            className="hidden h-40 w-40 sm:block"
            alt="peated robot"
          />
        </div>
      </div>

      {bottle.createdBy && (
        <div className="text-light mt-8 text-center text-sm sm:text-left">
          This bottle was first added by{" "}
          <Link
            href={`/users/${bottle.createdBy.username}`}
            className="font-medium hover:underline"
          >
            {bottle.createdBy.displayName}
          </Link>{" "}
          {bottle.createdAt && <TimeSince date={bottle.createdAt} />}
        </div>
      )}
    </>
  );
}
