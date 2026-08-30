import { formatBottleDisplayName } from "@peated/server/lib/bottleDisplayName";
import type { ExternalReview, PagingRel } from "@peated/server/types";
import * as stylex from "@stylexjs/stylex";

import { colors, fonts, space } from "../../styles/tokens.stylex";
import { AdminTextLink } from "./adminContent.stylex";
import { AdminTable } from "./adminTable.stylex";

const publishedDateFormatter = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
  year: "numeric",
});

export default function ReviewTable({
  reviews,
  rel,
}: {
  reviews: ExternalReview[];
  rel?: PagingRel;
}) {
  return <ReviewRows reviews={reviews} rel={rel} />;
}

export function ReviewRows({
  reviews,
  rel,
}: {
  reviews: ExternalReview[];
  rel?: PagingRel;
}) {
  return (
    <AdminTable
      columns={[
        {
          fill: true,
          name: "review",
          value: (review) => {
            const bottleName = review.bottle
              ? formatBottleDisplayName(review.bottle)
              : "No bottle";
            return (
              <span {...stylex.props(styles.review)}>
                <AdminTextLink href={review.url} title={review.name} truncate>
                  {review.name}
                </AdminTextLink>
                <span {...stylex.props(styles.matchLine)}>
                  <span aria-hidden="true" {...stylex.props(styles.arrow)}>
                    →
                  </span>
                  {review.bottle ? (
                    <AdminTextLink
                      href={`/bottles/${review.bottle.id}`}
                      title={bottleName}
                      truncate
                    >
                      {bottleName}
                    </AdminTextLink>
                  ) : (
                    <span {...stylex.props(styles.match)}>{bottleName}</span>
                  )}
                  <span {...stylex.props(styles.metadata)}>
                    {" · "}
                    {review.article.publishedAt ? (
                      <time dateTime={review.article.publishedAt}>
                        Published{" "}
                        {publishedDateFormatter.format(
                          new Date(review.article.publishedAt),
                        )}
                      </time>
                    ) : (
                      "Publish date unknown"
                    )}
                  </span>
                </span>
              </span>
            );
          },
        },
        {
          align: "right",
          name: "score",
          value: (review) => (
            <span {...stylex.props(styles.score)}>
              {review.nativeScore?.display ?? "—"}
            </span>
          ),
        },
      ]}
      items={reviews}
      rel={rel}
    />
  );
}

const styles = stylex.create({
  review: {
    display: "flex",
    minWidth: 0,
    flexDirection: "column",
    gap: space.x1,
  },
  matchLine: {
    display: "flex",
    minWidth: 0,
    alignItems: "baseline",
    gap: space.x1,
  },
  arrow: {
    flexShrink: 0,
    color: colors.inkMuted,
  },
  match: {
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  metadata: {
    flexShrink: 0,
    color: colors.inkMuted,
    fontFamily: fonts.data,
    fontSize: "11px",
  },
  score: {
    whiteSpace: "nowrap",
  },
});
