"use client";

import { ArrowTopRightOnSquareIcon } from "@heroicons/react/24/outline";
import type { Outputs } from "@peated/server/orpc/router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useORPC } from "../lib/orpc/context";
import Heading from "./heading";

const publicationDateFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeZone: "UTC",
});

export default function BottleReviews({ bottleId }: { bottleId: number }) {
  const orpc = useORPC();
  const {
    data: { results },
  } = useSuspenseQuery(
    orpc.reviews.list.queryOptions({
      input: {
        bottle: bottleId,
      },
    }),
  );

  return <BottleReviewList results={results} />;
}

type ReviewListItem = Outputs["reviews"]["list"]["results"][number];

export function BottleReviewList({ results }: { results: ReviewListItem[] }) {
  const reviews = results.filter((review) => review.site);
  if (!reviews.length) return null;

  return (
    <>
      <Heading as="h3">The Critics</Heading>
      <ul className="mb-4 divide-y divide-slate-800">
        {reviews.map((review) => {
          const site = review.site!;
          return (
            <li key={review.id} className="py-4 first:pt-2">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-semibold">{site.name}</p>
                  {review.reviewerName || review.article.publishedAt ? (
                    <p className="text-muted mt-1 text-sm">
                      {review.reviewerName ? `By ${review.reviewerName}` : null}
                      {review.reviewerName && review.article.publishedAt
                        ? " · "
                        : null}
                      {review.article.publishedAt ? (
                        <time dateTime={review.article.publishedAt}>
                          {publicationDateFormatter.format(
                            new Date(review.article.publishedAt),
                          )}
                        </time>
                      ) : null}
                    </p>
                  ) : null}
                </div>
                {review.nativeScore ? (
                  <span className="shrink-0 font-semibold">
                    {review.nativeScore.display}
                  </span>
                ) : null}
              </div>
              {review.summary ? (
                <p className="mt-3 text-sm leading-6 text-slate-200">
                  <span className="font-semibold">
                    Peated summary of {site.name}:
                  </span>{" "}
                  {review.summary}
                </p>
              ) : null}
              <a
                href={review.url}
                className="text-highlight mt-3 inline-flex items-center gap-1 text-sm font-semibold hover:underline"
              >
                Read the full review on {site.name}
                <ArrowTopRightOnSquareIcon className="h-4 w-4" />
              </a>
            </li>
          );
        })}
      </ul>
    </>
  );
}
