"use client";

import { ArrowTopRightOnSquareIcon } from "@heroicons/react/24/outline";
import { getRatingBand } from "@peated/server/constants";
import type { Outputs } from "@peated/server/orpc/router";
import useAuth from "@peated/web/hooks/useAuth";
import {
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { useState } from "react";
import { useORPC } from "../lib/orpc/context";
import Button from "./button";
import Heading from "./heading";
import TextAreaField from "./textAreaField";
import TextInput from "./textInput";

const publicationDateFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeZone: "UTC",
});

export default function BottleReviews({ bottleId }: { bottleId: number }) {
  const orpc = useORPC();
  const {
    data: { results },
  } = useSuspenseQuery(
    orpc.externalReviews.list.queryOptions({
      input: {
        bottle: bottleId,
        sort: "name",
      },
    }),
  );
  const {
    data: { results: memberResults },
  } = useSuspenseQuery(
    orpc.memberReviews.list.queryOptions({ input: { bottle: bottleId } }),
  );

  return (
    <>
      <MyReview bottleId={bottleId} />
      <MemberReviewList results={memberResults} />
      <ExternalReviewList results={results} />
    </>
  );
}

type MemberReview = Outputs["memberReviews"]["list"]["results"][number];

function MyReview({ bottleId }: { bottleId: number }) {
  const { user } = useAuth();
  const orpc = useORPC();
  const myReviewOptions = orpc.memberReviews.getMy.queryOptions({
    input: { bottle: bottleId },
  });
  const { data: review } = useQuery({
    ...myReviewOptions,
    enabled: Boolean(user),
  });

  if (!user) return null;

  return (
    <MemberReviewForm
      key={review ? `${review.id}:${review.updatedAt}` : "new"}
      bottleId={bottleId}
      review={review}
      myReviewQueryKey={myReviewOptions.queryKey}
    />
  );
}

function MemberReviewForm({
  bottleId,
  review,
  myReviewQueryKey,
}: {
  bottleId: number;
  review: Outputs["memberReviews"]["getMy"] | undefined;
  myReviewQueryKey: readonly unknown[];
}) {
  const orpc = useORPC();
  const queryClient = useQueryClient();
  const saveMutation = useMutation(orpc.memberReviews.save.mutationOptions());
  const deleteMutation = useMutation(
    orpc.memberReviews.delete.mutationOptions(),
  );
  const [score, setScore] = useState(review ? String(review.score) : "");
  const [notes, setNotes] = useState(review?.notes ?? "");

  async function refresh() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: myReviewQueryKey }),
      queryClient.invalidateQueries({
        queryKey: orpc.memberReviews.list.key({
          input: { bottle: bottleId },
        }),
      }),
    ]);
  }

  const scoreNumber = Number(score);
  const validScore =
    score !== "" &&
    Number.isInteger(scoreNumber) &&
    scoreNumber >= 0 &&
    scoreNumber <= 100;

  return (
    <section className="mb-6 rounded-lg border border-slate-800 p-4">
      <Heading as="h3">Your review</Heading>
      <form
        className="space-y-4"
        onSubmit={async (event) => {
          event.preventDefault();
          if (!validScore) return;
          await saveMutation.mutateAsync({
            bottle: bottleId,
            score: scoreNumber,
            notes: notes.trim() || null,
          });
          await refresh();
        }}
      >
        <label
          htmlFor="member-review-score"
          className="block text-sm font-medium"
        >
          Score
          <TextInput
            id="member-review-score"
            className="mt-1"
            type="number"
            min={0}
            max={100}
            step={1}
            inputMode="numeric"
            value={score}
            suffixLabel="/ 100"
            onChange={(event) => setScore(event.target.value)}
          />
        </label>
        <TextAreaField
          name="member-review-notes"
          label="Notes"
          rows={4}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
        />
        <div className="flex gap-2">
          <Button
            type="submit"
            color="highlight"
            disabled={!validScore || saveMutation.isPending}
          >
            {review ? "Update review" : "Save review"}
          </Button>
          {review ? (
            <Button
              type="button"
              color="danger"
              disabled={deleteMutation.isPending}
              onClick={async () => {
                await deleteMutation.mutateAsync({ bottle: bottleId });
                setScore("");
                setNotes("");
                await refresh();
              }}
            >
              Delete
            </Button>
          ) : null}
        </div>
      </form>
    </section>
  );
}

function MemberReviewList({ results }: { results: MemberReview[] }) {
  if (!results.length) return null;
  return (
    <section className="mb-6">
      <Heading as="h3">Member reviews</Heading>
      <ul className="divide-y divide-slate-800">
        {results.map((review) => (
          <li key={review.id} className="py-4 first:pt-2">
            <div className="flex items-baseline justify-between gap-4">
              <span className="font-semibold">{review.createdBy.username}</span>
              <span className="font-semibold">{review.score}/100</span>
            </div>
            {review.notes ? (
              <p className="mt-2 whitespace-pre-wrap text-sm text-slate-200">
                {review.notes}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

type ExternalReviewListItem =
  Outputs["externalReviews"]["list"]["results"][number];

export function ExternalReviewList({
  results,
}: {
  results: ExternalReviewListItem[];
}) {
  const externalReviews = results.filter(
    (externalReview) => externalReview.site,
  );
  if (!externalReviews.length) return null;

  return (
    <>
      <Heading as="h3">External reviews</Heading>
      <ul className="mb-4 divide-y divide-slate-800">
        {externalReviews.map((externalReview) => {
          const site = externalReview.site!;
          const scoreBand =
            externalReview.nativeScore?.scale === 100
              ? getRatingBand(externalReview.nativeScore.value)
              : null;
          return (
            <li key={externalReview.id} className="py-4 first:pt-2">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-semibold">{site.name}</p>
                  {externalReview.reviewerName ||
                  externalReview.article.publishedAt ? (
                    <p className="text-muted mt-1 text-sm">
                      {externalReview.reviewerName
                        ? `By ${externalReview.reviewerName}`
                        : null}
                      {externalReview.reviewerName &&
                      externalReview.article.publishedAt
                        ? " · "
                        : null}
                      {externalReview.article.publishedAt ? (
                        <time dateTime={externalReview.article.publishedAt}>
                          {publicationDateFormatter.format(
                            new Date(externalReview.article.publishedAt),
                          )}
                        </time>
                      ) : null}
                    </p>
                  ) : null}
                </div>
                {externalReview.nativeScore ? (
                  <span className="shrink-0 font-semibold">
                    {externalReview.nativeScore.display}
                    {scoreBand ? (
                      <span className="text-muted font-normal">
                        {" "}
                        · {scoreBand.label}
                      </span>
                    ) : null}
                  </span>
                ) : null}
              </div>
              {externalReview.summary ? (
                <p className="mt-3 text-sm leading-6 text-slate-200">
                  <span className="font-semibold">
                    Peated summary of {site.name}:
                  </span>{" "}
                  {externalReview.summary}
                </p>
              ) : null}
              <a
                href={externalReview.url}
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
